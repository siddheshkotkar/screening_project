import os
import shutil
import subprocess
import uuid
import logging
from urllib.parse import urlparse
from typing import Dict, Any
import httpx
from app.config import settings

logger = logging.getLogger(__name__)

class DeployService:
    @staticmethod
    def deploy_to_gitlab(
        session_file_path: str,
        jira_num: str,
        branch: str,
        commit_message: str,
        tag_name: str
    ) -> Dict[str, Any]:
        """
        Clones remote repository, checks out/creates a branch, updates the target keywords file,
        commits, tags, and pushes branch and tag to the remote repository.
        Git credentials (token, repo_url) are read from settings, and git user identity is
        fetched dynamically from the GitLab API.
        """
        token = settings.gitlab_token
        repo_url = settings.gitlab_repo_url
        file_path_in_repo = "current/refData/Keywords and Lists.txt"

        # Create temp directory inside the backend/data directory
        base_temp_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.dirname(__file__))), 
            "data", 
            "temp_deploy_clones"
        )
        os.makedirs(base_temp_dir, exist_ok=True)
        
        unique_id = str(uuid.uuid4())
        clone_dir = os.path.join(base_temp_dir, unique_id)
        
        # Build authenticated repository URL
        auth_url = repo_url
        if repo_url.startswith("https://"):
            auth_url = repo_url.replace("https://", f"https://oauth2:{token}@")
        elif repo_url.startswith("http://"):
            auth_url = repo_url.replace("http://", f"http://oauth2:{token}@")
            
        logs = []

        # 1. Fetch bot user details dynamically from GitLab API (matching UAT script)
        logs.append("Fetching bot user details for current token...")
        try:
            parsed_url = urlparse(repo_url)
            api_base = f"{parsed_url.scheme}://{parsed_url.netloc}"
        except Exception:
            api_base = "https://gitlab.example.com"
        api_url = f"{api_base}/api/v4/user"

        email = None
        username = None

        try:
            # We ignore SSL verification for self-signed certificates in UAT environment
            response = httpx.get(
                api_url, 
                headers={"PRIVATE-TOKEN": token}, 
                verify=False, 
                timeout=5.0
            )
            if response.status_code == 200:
                data = response.json()
                email = data.get("email")
                username = data.get("username")
            else:
                logs.append(f"GitLab API returned status code {response.status_code}: {response.text}")
        except Exception as e:
            logs.append(f"Failed to fetch bot user details from GitLab: {str(e)}")

        if not email or not username:
            err_msg = "Error: Could not fetch bot email"
            logs.append(err_msg)
            return {
                "status": "error",
                "message": err_msg,
                "logs": logs
            }

        logs.append("Configuring git with bot identity:")
        logs.append(f"  Email: {email}")
        logs.append(f"  Username: {username}")

        def run_git(args, cwd=None):
            cmd_str = " ".join(args)
            # Mask token in logs for security
            safe_cmd_str = cmd_str.replace(token, "********") if token else cmd_str
            logs.append(f"Running command: {safe_cmd_str}")
            
            result = subprocess.run(
                args,
                cwd=cwd,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                env={**os.environ, "GIT_TERMINAL_PROMPT": "0"}
            )
            
            if result.stdout:
                logs.append(f"stdout: {result.stdout.strip()}")
            if result.stderr:
                logs.append(f"stderr: {result.stderr.strip()}")
                
            if result.returncode != 0:
                raise RuntimeError(
                    f"Command '{safe_cmd_str}' failed with exit code {result.returncode}. stderr: {result.stderr.strip()}"
                )
            return result.stdout
            
        try:
            # 2. Clone repository (disabling SSL check on clone)
            run_git(["git", "-c", "http.sslVerify=false", "clone", auth_url, clone_dir])
            
            # Disable SSL verify for subsequent commands in this clone
            run_git(["git", "config", "http.sslVerify", "false"], cwd=clone_dir)
            
            # 3. Configure Git user
            run_git(["git", "config", "user.email", email], cwd=clone_dir)
            run_git(["git", "config", "user.name", username], cwd=clone_dir)
            
            # 4. Create and switch to the target branch
            try:
                run_git(["git", "checkout", "-b", branch], cwd=clone_dir)
                logs.append(f"{branch} is created")
            except Exception:
                # If branch creation fails (e.g. branch already exists), checkout -f directly
                run_git(["git", "checkout", "-f", branch], cwd=clone_dir)
            
            # 5. Overwrite target file
            target_file_path = os.path.join(clone_dir, file_path_in_repo)
            os.makedirs(os.path.dirname(target_file_path), exist_ok=True)
            
            # Read from session file and write to target file in repo
            with open(session_file_path, "r", encoding="utf-8") as f_src:
                content = f_src.read()
            with open(target_file_path, "w", encoding="utf-8") as f_dst:
                f_dst.write(content)
                
            logs.append(f"Successfully wrote updates to: {file_path_in_repo}")
            
            # 6. Add changes
            run_git(["git", "add", file_path_in_repo], cwd=clone_dir)
            
            # 7. Commit changes (Commit message is GCWS-31803 or user-inputted commit_message)
            status_out = run_git(["git", "status", "--porcelain"], cwd=clone_dir)
            if status_out.strip():
                run_git(["git", "commit", "-m", commit_message], cwd=clone_dir)
            else:
                logs.append("No changes detected in file. Skipping commit.")
                
            # 8. Push branch
            run_git(["git", "push", "origin", branch], cwd=clone_dir)
            
            # 9. Create and push tag
            run_git(["git", "tag", "-f", tag_name], cwd=clone_dir)
            run_git(["git", "push", "origin", tag_name, "--force"], cwd=clone_dir)
            
            return {
                "status": "success",
                "message": f"Successfully deployed to branch '{branch}' and tagged '{tag_name}' in GitLab UAT.",
                "logs": logs
            }
            
        except Exception as e:
            logger.error(f"Deployment failed: {str(e)}")
            error_msg = str(e).replace(token, "********") if token else str(e)
            return {
                "status": "error",
                "message": f"Deployment failed: {error_msg}",
                "logs": logs
            }
        finally:
            # Clean up the directory
            if os.path.exists(clone_dir):
                try:
                    shutil.rmtree(clone_dir)
                except Exception as ex:
                    logger.warning(f"Failed to clean up clone directory {clone_dir}: {ex}")
