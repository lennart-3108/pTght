#!/usr/bin/env python3
"""
Match League Comprehensive Deployment Script
Uploads frontend and backend to test and production instances via SFTP
"""

import subprocess
import sys
import os

LFTP_USER = "rsftp_matchle"
LFTP_PASS = "Sursee.2026"
LFTP_HOST = "82.165.134.166"

FRONTEND_BUILD = "/Users/lennart/projects/match league/frontend/build"
BACKEND_SRC = "/Users/lennart/projects/match league/backend"

def run_lftp_cmds(instance, commands_script):
    """Run LFTP commands for a specific instance"""
    print(f"\n========== Deploying {instance.upper()} Instance ==========")
    
    cmd = [
        "lftp",
        "-u", f"{LFTP_USER},{LFTP_PASS}",
        f"ftp://{LFTP_HOST}"
    ]
    
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True
        )
        
        try:
            output, _ = proc.communicate(input=commands_script, timeout=600)
        except subprocess.TimeoutExpired:
            proc.kill()
            print(f"ERROR: LFTP timeout for {instance}")
            return False
        
        print(output)
        
        if proc.returncode != 0:
            print(f"Warning: LFTP exited with code {proc.returncode}")
        else:
            print(f"✓ {instance.upper()} deployment completed")
            
    except subprocess.TimeoutExpired:
        proc.kill()
        print(f"ERROR: LFTP timeout for {instance}")
        return False
    except Exception as e:
        print(f"ERROR deploying {instance}: {e}")
        return False
    
    return True

def deploy():
    """Deploy to both test and production instances"""
    
    print("=== Match League Full Deployment ===")
    print(f"Frontend: {FRONTEND_BUILD}")
    print(f"Backend: {BACKEND_SRC}")
    
    # Test instance commands
    test_commands = f"""
set net:max-retries 3
set net:timeout 30
cd /matchleague.org/test

rm -rf frontend-old 2>/dev/null || true
mv frontend frontend-old 2>/dev/null || true
mkdir frontend

rm -rf backend-old 2>/dev/null || true
mv backend backend-old 2>/dev/null || true
mkdir backend

mkdir -p logs

echo "Uploading test frontend..."
mirror -e --reverse "{FRONTEND_BUILD}/" frontend/

echo "Uploading test backend..."
mirror -e --reverse "{BACKEND_SRC}/" backend/

echo "Configuring test .env..."
cd backend
rm -f .env 2>/dev/null || true
rename .env.test .env || true
cd ..

echo "Test deployment complete!"
quit
"""
    
    # Production instance commands
    prod_commands = f"""
set net:max-retries 3
set net:timeout 30
cd /matchleague.org/prod

rm -rf frontend-old 2>/dev/null || true
mv frontend frontend-old 2>/dev/null || true
mkdir frontend

rm -rf backend-old 2>/dev/null || true
mv backend backend-old 2>/dev/null || true
mkdir backend

mkdir -p logs

echo "Uploading production frontend..."
mirror -e --reverse "{FRONTEND_BUILD}/" frontend/

echo "Uploading production backend..."
mirror -e --reverse "{BACKEND_SRC}/" backend/

echo "Configuring production .env..."
cd backend
rm -f .env 2>/dev/null || true
rename .env.prod .env || true
cd ..

echo "Production deployment complete!"
quit
"""
    
    # Run deployments
    success_test = run_lftp_cmds("test", test_commands)
    success_prod = run_lftp_cmds("prod", prod_commands)
    
    print("\n" + "=" * 60)
    print("=== Deployment Summary ===")
    if success_test:
        print("✓ Test instance deployed")
    else:
        print("✗ Test instance deployment failed")
    
    if success_prod:
        print("✓ Production instance deployed")
    else:
        print("✗ Production instance deployment failed")
    
    print("\n=== Next Steps ===")
    print("Backend startup (requires SSH or server admin panel):")
    print("  Test:  bash /matchleague.org/test/backend/start-backend-enhanced.sh test")
    print("  Prod:  bash /matchleague.org/prod/backend/start-backend-enhanced.sh prod")
    
    return success_test and success_prod

if __name__ == "__main__":
    try:
        success = deploy()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nDeployment cancelled")
        sys.exit(1)
    except Exception as e:
        print(f"ERROR: {e}")
        sys.exit(1)
