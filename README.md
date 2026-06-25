# arkadia_cal

Rozszerzenie Chrome: kalendarz **Imperium** i **Ishtar** dla oficjalnego klienta Arkadii (arkadia.rpg.pl).

## Instalacja

1. Pobierz [arkadia_cal_latest.zip](https://isithunzi000.github.io/www-arkadia_cal/arkadia_cal_latest.zip)
2. Rozpakuj ZIP do dowolnego folderu
3. W Chrome: `chrome://extensions/` → włącz **Tryb deweloperski** → **Wczytaj rozpakowany** → wskaż folder

## Komendy

| Komenda | Opis |
|---|---|
| `/imperium` | Kalendarz Imperium |
| `/imperium help` | Pomoc Imperium |
| `/ishtar` | Kalendarz Ishtar |
| `/ishtar help` | Pomoc Ishtar |

## Co pokazuje

**Imperium** (`/imperium`):
- Najbliższy nów i pełnia Mannslieba z datami RL
- Najbliższe wydarzenie sezonowe
- Hexentag, Hexennacht, Geheimnisnacht
- Inne święta interkalarne

**Ishtar** (`/ishtar`):
- Belleteyn i Saovine (główne święta magiczne)
- Święta astronomiczne (Midinvaerne, Birke, Midaete, Velen)
- Imbaelk, Lammas
- Pełnia księżyca (okno 2 dni)
- Festyn w Eysenlaan (2 najbliższe wystąpienia)

## Aktualizacja

Rozszerzenie sprawdza dostępność nowej wersji przy każdym załadowaniu strony.
Jeśli dostępna jest aktualizacja, pojawia się powiadomienie w prawym dolnym rogu
z przyciskiem do pobrania nowego ZIP.

## Techniczne

- Logika kalendarza 1:1 z pluginami Dargoth (imperium_cal, ishtar_cal)
- Anchor zapisywany w localStorage po każdym odczycie `czas`
- Ekstrapolacja z anchora przy kolejnych wywołaniach
