#!/usr/bin/env bash
docker exec supabase-db psql -U postgres -d postgres -c "\d v2.guests"
