-- Add passwordHash column to User table for password-based authentication
ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;
