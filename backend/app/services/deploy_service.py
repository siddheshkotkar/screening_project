import os
import shutil
import subprocess
import uuid
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class DeployService:
    @staticmethod
    def deploy_to_gitlab(
        session_file_path: str,
        token: str,
        repo_url: str,
        email: str,
        name: str,
        branch: str,
        file_path_in_repo: str,
        commit_message: str,
        tag_name: str
    ) -> Dict[str, Any]:
        """
        Clones remote repository, checks out/creates a branch, updates the target keywords file,
        commits, tags, and pushes branch and tag to the remote repository.
        """
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
        
        def run_git(args, cwd=None):
            cmd_str = " ".join(args)
            # Mask token in logs for security
            safe_cmd_str = cmd_str.replace(token, "********")
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
            # 1. Clone repository (disabling SSL check on clone)
            run_git(["git", "-c", "http.sslVerify=false", "clone", auth_url, clone_dir])
            
            # Disable SSL verify for subsequent commands in this clone
            run_git(["git", "config", "http.sslVerify", "false"], cwd=clone_dir)
            
            # 2. Configure Git user
            run_git(["git", "config", "user.email", email], cwd=clone_dir)
            run_git(["git", "config", "user.name", name], cwd=clone_dir)
            
            # 3. Create and switch to the target branch
            # checkout -B resets the branch if it already exists
            run_git(["git", "checkout", "-B", branch], cwd=clone_dir)
            
            # 4. Overwrite target file
            target_file_path = os.path.join(clone_dir, file_path_in_repo)
            os.makedirs(os.path.dirname(target_file_path), exist_ok=True)
            
            # Read from session file and write to target file in repo
            with open(session_file_path, "r", encoding="utf-8") as f_src:
                content = f_src.read()
            with open(target_file_path, "w", encoding="utf-8") as f_dst:
                f_dst.write(content)
                
            logs.append(f"Successfully wrote updates to: {file_path_in_repo}")
            
            # 5. Add changes
            run_git(["git", "add", file_path_in_repo], cwd=clone_dir)
            
            # 6. Commit if changes are present
            status_out = run_git(["git", "status", "--porcelain"], cwd=clone_dir)
            if status_out.strip():
                run_git(["git", "commit", "-m", commit_message], cwd=clone_dir)
            else:
                logs.append("No changes detected in file. Skipping commit.")
                
            # 7. Push branch
            run_git(["git", "push", "origin", branch], cwd=clone_dir)
            
            # 8. Create and push tag
            run_git(["git", "tag", "-f", tag_name], cwd=clone_dir)
            run_git(["git", "push", "origin", tag_name, "--force"], cwd=clone_dir)
            
            return {
                "status": "success",
                "message": f"Successfully deployed to branch '{branch}' and tagged '{tag_name}' in GitLab UAT.",
                "logs": logs
            }
            
        except Exception as e:
            logger.error(f"Deployment failed: {str(e)}")
            error_msg = str(e).replace(token, "********")
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
