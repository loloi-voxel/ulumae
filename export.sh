#!/usr/bin/env bash

OUTPUT="export_code.txt"
> "$OUTPUT"

printf "==== EXPORT CODE ====\n" >> "$OUTPUT"

FILES=(
  "app/archive/[memorialId]/_hooks/archiveRoleStore.ts"
)

for FILE in "${FILES[@]}"; do
  if [ -f "$FILE" ]; then
    printf "\n===== FICHIER: %s =====\n\n" "$FILE" >> "$OUTPUT"
    cat "$FILE" >> "$OUTPUT"
  else
    printf "\n[ERREUR] Fichier introuvable: %s\n\n" "$FILE" >> "$OUTPUT"
  fi
done

printf "\n=== FIN ===\n" >> "$OUTPUT"

echo "Export terminé dans $OUTPUT"