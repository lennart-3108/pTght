#!/usr/bin/env python3
"""
Match League Backend Deployment Script
Uploads backend source code to test and production instances via FTP
(Frontend assumed already deployed)
"""

import subprocess
import sys

LFTP_USER = "rsftp_matchle"
LFTP_PASS = "Sursee.2026"
LFTP_HOST = "82.165.134.166"

BACKEND_SRC = "/Users/lennart/projects/match league/backend"

def run_lftp_cmds_long(instance, commands_script):
    """Run LFTP commands with very long timeout for large uploads"""
    print(f"\n========== Deploying {instance.upper()} Backend ==========")
    
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
        
        # Use very long timeout for large file uploads
        try:
            output, _ = proc.communicate(input=commands_script, timeout=3600)  # 1 hour
        except subprocess.TimeoutExpired:
            proc.kill()
            print(f"ERROR: LFTP timeout for {instance} backend after 1 hour. Upload may still be in progress.")
            return False
        
        print(output)
        
        if proc.returncode != 0:
            print(f"Warning: LFTP exited with code {proc.returncode}")
            return False
        else:
            print(f"✓ {instance.upper()} backend deployment completed")
            
    except Exception as e:
        print(f"ERROR deploying {instance}: {e}")
        return False
    
    return True

def deploy():
    """Deploy backend to both test and production instances"""
    
    print("=== Match League Backend Deployment ===")
    print(f"Backend Source: {BACKEND_SRC}")
    print("(Frontend assumed already deployed)")
    
    # Test instance commands
    test_commands = f"""
set net:max-retries 2
set net:timeout 60
cd /matchleague.org/test

echo "Checking backend directory..."
mkdir backend 2>/dev/null || true
cd backend

echo "Uploading backend source code..."
mirror -e --reverse "{BACKEND_SRC}/" .

echo "Configuring test .env..."
rm -f .env 2>/dev/null || true
mv .env.test .env 2>/dev/null || true

echo "Test backend deployment complete!"
cd ..
bye
"""
    
    # Production instance commands
    prod_commands = f"""
set net:max-retries 2
set net:timeout 60
cd /matchleague.org/prod

echo "Checking backend directory..."
mkdir backend 2>/dev/null || true
cd backend

echo "Uploading backend source code..."
mirror -e --reverse "{BACKEND_SRC}/" .

echo "Configuring production .env..."
rm -f .env 2>/dev/null || true
mv .env.prod .env 2>/dev/null || true

echo "Production backend deployment complete!"
cd ..
bye
"""
    
    # Run deployments
    print("\n" + "=" * 60)
    success_test = run_lftp_cmds_long("test", test_commands)
    print("\n" + "=" * 60)
    success_prod = run_lftp_cmds_long("prod", prod_commands)
    
    print("\n" + "=" * 60)
    print("=== Deployment Summary ===")
    if success_test:
        print("✓ Test backend deployed")
    else:
        print("✗ Test backend deployment failed or timed out")
    
    if success_prod:
        print("✓ Production backend deployed")
    else:
        print("✗ Production backend deployment failed or timed out")
    
    print("\n=== Next Steps ===")
    print("1. SSH into server or use Strato admin panel")
    print("2. Run backend startup on test:")
    print("   bash /matchleague.org/test/backend/start-backend-enhanced.sh test")
    print("3. Run backend startup on prod:")
    print("   bash /matchleague.org/prod/backend/start-backend-enhanced.sh prod")
    print("\n4. Verify with curl:")
    print("   curl http://test.matchleague.org/api/health")
    print("   curl http://matchleague.org/api/health")
    
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
        import traceback
        traceback.print_exc()
        sys.exit(1)
