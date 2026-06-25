# arkadia_cal

Rozszerzenie Chrome: kalendarz **Imperium** i **Ishtar** dla oficjalnego klienta Arkadii (arkadia.rpg.pl).

## Instalacja

1. Pobierz [arkadia_cal.zip](https://isithunzi000.github.io/www-arkadia_cal/arkadia_cal.zip)
2. Rozpakuj ZIP — powstanie folder `arkadia_cal`
3. W Chrome: `chrome://extensions/` → włącz **Tryb deweloperski** → **Wczytaj rozpakowany** → wskaż folder `arkadia_cal`

## Aktualizacja

1. Pobierz nowy [arkadia_cal.zip](https://isithunzi000.github.io/www-arkadia_cal/arkadia_cal.zip)
2. Rozpakuj do **tego samego folderu** `arkadia_cal` (nadpisz pliki)
3. W Chrome: `chrome://extensions/` → kliknij **↺** na rozszerzeniu arkadia_cal

Rozszerzenie automatycznie sprawdza dostępność nowej wersji i wyświetla powiadomienie.

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

## Techniczne

- Logika kalendarza 1:1 z pluginami Dargoth (imperium_cal, ishtar_cal)
- Anchor zapisywany w localStorage po każdym odczycie `czas`
- Ekstrapolacja z anchora przy kolejnych wywołaniach
