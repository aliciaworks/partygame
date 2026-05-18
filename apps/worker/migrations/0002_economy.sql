-- Migration: Economy System
-- Creates tables for player balances and IAP receipt verification

CREATE TABLE IF NOT EXISTS player_balances (
  player_id TEXT NOT NULL,
  currency_id TEXT NOT NULL,
  amount INTEGER NOT NULL DEFAULT 0,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (player_id, currency_id)
);

CREATE TABLE IF NOT EXISTS iap_receipts (
  transaction_id TEXT PRIMARY KEY,
  player_id TEXT NOT NULL,
  platform TEXT NOT NULL, -- 'apple', 'google', 'windows', 'amazon'
  raw_receipt TEXT NOT NULL,
  status TEXT NOT NULL, -- 'valid', 'invalid', 'pending'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
