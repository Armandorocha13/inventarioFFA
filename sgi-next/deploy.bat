@echo off
if exist ".vercel" rmdir /S /Q .vercel
call npx vercel --prod --name inventarioffa --yes
echo postgresql://neondb_owner:npg_cA4grmInaPq0@ep-sparkling-forest-ap4ln943-pooler.c-7.us-east-1.aws.neon.tech/neondb?sslmode=require^&channel_binding=require | npx vercel env add DATABASE_URL production
call npx vercel --prod --yes
