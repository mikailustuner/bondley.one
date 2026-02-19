#!/usr/bin/env python3
"""
Admin kullanıcı oluşturma script'i
Bu script admin kullanıcısını oluşturur veya şifresini günceller.
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

async def create_admin():
    settings = get_settings()
    admin_email = settings.ADMIN_EMAIL
    admin_password = settings.ADMIN_INIT_PASSWORD.strip() if settings.ADMIN_INIT_PASSWORD else "admin123"
    
    print("=" * 50)
    print("Admin Kullanıcı Oluşturma")
    print("=" * 50)
    print(f"Email: {admin_email}")
    print(f"Şifre: {admin_password}")
    print("=" * 50)
    
    async with async_session_factory() as session:
        result = await session.execute(select(User).where(User.email == admin_email))
        admin = result.scalar_one_or_none()
        
        if admin:
            print(f"\n⚠️  Admin kullanıcı zaten mevcut: {admin_email}")
            print("Şifre güncelleniyor...")
            admin.password_hash = hash_password(admin_password)
            admin.role = "admin"
            admin.is_active = True
            await session.commit()
            print(f"✓ Admin şifresi güncellendi!")
        else:
            print(f"\n✓ Yeni admin kullanıcı oluşturuluyor...")
            admin = User(
                email=admin_email,
                password_hash=hash_password(admin_password),
                full_name="System Admin",
                role="admin",
                is_active=True,
            )
            session.add(admin)
            await session.commit()
            await session.refresh(admin)
            print(f"✓ Admin kullanıcı oluşturuldu!")
        
        print("\n" + "=" * 50)
        print("GİRİŞ BİLGİLERİ")
        print("=" * 50)
        print(f"Email:    {admin_email}")
        print(f"Şifre:    {admin_password}")
        print("=" * 50)
        print("\n✓ İşlem tamamlandı!")

if __name__ == "__main__":
    try:
        asyncio.run(create_admin())
    except Exception as e:
        print(f"\n❌ HATA: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
