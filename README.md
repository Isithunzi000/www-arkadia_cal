# arkadia_cal

Rozszerzenie Chrome: kalendarz **Imperium** i **Ishtar** dla oficjalnego klienta [arkadia.rpg.pl](https://arkadia.rpg.pl).

## Instalacja

1. Pobierz [arkadia_cal.zip](https://isithunzi000.github.io/www-arkadia_cal/arkadia_cal.zip)
2. Rozpakuj ZIP — powstanie folder `arkadia_cal`
3. Chrome: `chrome://extensions/` → włącz **Tryb deweloperski** → **Wczytaj rozpakowany** → wskaż folder `arkadia_cal`

## Aktualizacja

Rozszerzenie samo sprawdza dostępność nowej wersji i wyświetla powiadomienie.

1. Pobierz nowy [arkadia_cal.zip](https://isithunzi000.github.io/www-arkadia_cal/arkadia_cal.zip)
2. Rozpakuj do **tego samego folderu** `arkadia_cal` (nadpisz pliki)
3. Chrome: `chrome://extensions/` → kliknij **↺** na rozszerzeniu arkadia_cal

## Użycie

| Komenda | Opis |
|---|---|
| `/imperium` | Kalendarz Imperium |
| `/imperium help` | Pomoc Imperium |
| `/ishtar` | Kalendarz Ishtar |
| `/ishtar help` | Pomoc Ishtar |

### Co pokazuje

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

### Techniczne

- Logika kalendarza 1:1 z pluginami Dargoth (imperium_cal, ishtar_cal)
- Data zapisuje się w localStorage przy odczycie z komendy `/imperium` lub `/ishtar` i przeżywa restart przeglądarki
- Gdy odczyt `czas` się nie powiedzie albo postać jest w innej domenie, plugin liczy z zapisanej daty (i mówi o tym), a gdy jej nie ma — wyświetla komunikat

## Dla maintainera

Nowa wersja: edytuj `cal.js` i `manifest.json` (źródła to zawartość najnowszego zipa w `releases/`), potem `python3 scripts/make_release_zip.py <katalog_źródłowy> X.Y.Z` → commit z nowym zipem w `releases/` → push. Workflow Pages sam buduje `dist/` i `index.json` — odpala się wyłącznie przy zmianie `releases/*.zip` (push README czy skryptów go nie rusza). Build jest deterministyczny: te same źródła = identyczny SHA-256 zipa.
