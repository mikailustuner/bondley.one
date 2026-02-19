#!/usr/bin/env python3
"""
Admin şifre güncelleme script'i
Bu script veritabanındaki admin kullanıcısının şifresini .env dosyasındaki ADMIN_INIT_PASSWORD ile günceller.

Kullanım:
    python3 update-admin-password.py
    veya
    docker exec fincalc-api python3 /app/update-admin-password.py
"""

import asyncio
import sys
import os
from pathlib import Path

# Add apps/api to path
project_root = Path(__file__).parent.resolve()
if (project_root / "apps" / "api").exists():
    sys.path.insert(0, str(project_root / "apps" / "api"))
elif Path("/app").exists():
    # Docker container içinde çalışıyorsa
    sys.path.insert(0, "/app")

from app.core.database import async_session_factory
from app.core.security import hash_password
from app.core.config import get_settings
from app.models.user import User
from sqlalchemy import select

async def update_admin_password():
    settings = get_settings()
    admin_email = settings.ADMIN_EMAIL
    new_password = settings.ADMIN_INIT_PASSWORD
    
    if not new_password or not new_password.strip():
        print("HATA: ADMIN_INIT_PASSWORD .env dosyasinda tanimli degil veya bos!")
        sys.exit(1)
    
    new_password = new_password.strip()
    
    print(f"Admin sifresi guncelleniyor...")
    print(f"  Email: {admin_email}")
    print(f"  Yeni sifre: {new_password}")
    
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == admin_email))
        admin = result.scalar_one_or_none()
        
        if not admin:
            print(f"\nAdmin kullanici bulunamadi: {admin_email}")
            print("Admin kullanici olusturuluyor...")
            admin = User(
                email=admin_email,
                password_hash=hash_password(new_password),
                full_name="System Admin",
                role="admin",
            )
            session.add(admin)
            await session.commit()
            print(f"✓ Admin kullanici olusturuldu: {admin_email}")
        else:
            print(f"\nMevcut admin kullanici bulundu: {admin_email}")
            admin.password_hash = hash_password(new_password)
            await session.commit()
            print(f"✓ Admin sifresi guncellendi: {admin_email}")
        
        print(f"\n✓ Guncelleme tamamlandi!")
        print(f"Giris bilgileri:")
        print(f"  Email: {admin_email}")
        print(f"  Password: {new_password}")

if __name__ == "__main__":
    try:
        asyncio.run(update_admin_password())
    except Exception as e:
        print(f"HATA: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
