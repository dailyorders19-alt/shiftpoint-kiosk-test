# ShiftPoint Fully Kiosk Browser beallitas

## Indulo URL

Fully Kiosk Browserben az indulo oldal legyen:

```text
https://sajat-domain.hu/kiosk.html
```

Helyi tesztnel:

```text
http://tablet-vagy-gep-cime/kiosk.html
```

## Javasolt Fully Kiosk beallitasok

- Web Content Settings / Start URL: `kiosk.html`
- Kiosk Mode: bekapcsolva
- Fullscreen Mode: bekapcsolva
- Keep Screen On: bekapcsolva
- Launch on Boot: bekapcsolva
- Enable Back Button: kikapcsolva
- Enable Home Button: kikapcsolva, ha a keszulek engedi
- Enable App Switch Button: kikapcsolva, ha a keszulek engedi
- Motion Detection / Screensaver: kikapcsolva az elso tesztnel
- Camera Permission: engedelyezve
- Admin PIN: kulon PIN, nem ugyanaz mint a ShiftPoint admin jelszo

## Fontos kulonbseg

- ShiftPoint admin jelszo: dolgozok, javitasok, exportok.
- Fully Kiosk Admin PIN: tablet feloldasa, Android beallitasok, kiosk kikapcsolasa.

## Teszt sorrend

1. Nyisd meg a `kiosk.html` oldalt normal bongeszoben.
2. Probald ki USB QR olvasoval.
3. Probald ki elso kameraval.
4. Ha mindketto mukodik, allitsd be Fully Kiosk Browserben.
5. Kapcsold be a teljes kiosk zarast csak a sikeres teszt utan.
