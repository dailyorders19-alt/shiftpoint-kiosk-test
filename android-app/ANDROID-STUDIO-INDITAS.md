# ShiftPoint Kiosk – Android Studio indítás

## Szükséges program

Telepítsd az Android Studio aktuális stabil verzióját. A telepítőben maradjon kijelölve:

- Android SDK
- Android SDK Platform
- Android Virtual Device

## Projekt megnyitása

1. Indítsd el az Android Studio programot.
2. Válaszd az **Open** lehetőséget.
3. Nyisd meg az `android-app` mappát.
4. Várd meg a Gradle-szinkronizálás végét.
5. Ha az Android Studio felajánlja az Android 36 SDK telepítését, engedélyezd.

## PWA-cím

A tesztalkalmazás ezt a működő GitHub Pages címet használja:

```text
https://dailyorders19-alt.github.io/shiftpoint-kiosk-test/scan.html
```

Később az adminbeállításokból lesz módosítható. Ebben a fázisban nem kell kézzel átírni.

## Első tabletes indítás

1. Engedélyezd a tableten a fejlesztői módot és az USB-hibakeresést.
2. USB-kábellel csatlakoztasd a tabletet.
3. A tableten fogadd el a számítógép hibakeresési engedélyét.
4. Android Studio-ban válaszd ki a tabletet.
5. Nyomd meg a zöld **Run** gombot.
6. Az első kamerahasználatkor engedélyezd a kamera hozzáférését.

## Hálózati hiba tesztelése

1. Indítsd el az alkalmazást működő internetkapcsolattal.
2. Ellenőrizd, hogy megjelenik a ShiftPoint felülete.
3. Kapcsold ki a tablet Wi-Fi-kapcsolatát.
4. Indítsd újra az alkalmazást.
5. A „Nincs hálózati kapcsolat” üzenetnek kell megjelennie.
6. Kapcsold vissza a Wi-Fi-kapcsolatot.
7. Az alkalmazás legfeljebb 10 másodpercen belül újrapróbálkozik és visszatölti a ShiftPoint felületét.

## Érintési korlátozás tesztelése

1. A kezdőképernyőn próbálj görgetni: nem szabad elmozdulnia.
2. Próbáld megnyomni a nyelvváltó gombokat: nem szabad reagálniuk.
3. A **Belépés** és **Kilépés** gombnak működnie kell.
4. Kameraindítás után a **Mégse** gombnak működnie kell.
5. Próbálj hosszú érintéssel kijelölni vagy helyi menüt nyitni: nem jelenhet meg.
6. Érintsd meg gyorsan ötször a jobb felső sarkot, összesen két másodpercen belül.
7. Rövid rezgésnek és az „Adminfeloldás érzékelve” tesztüzenetnek kell megjelennie.

Ebben a fázisban a Vissza gomb még bezárhatja az alkalmazást. Ez szándékos biztonsági tesztmód; a valódi kioszkzár későbbi fázis.
