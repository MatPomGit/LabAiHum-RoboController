# Analiza architektury i ryzyk integracji z rzeczywistym Unitree G1 EDU

## 1. Aktualna architektura (stan repo)

Aplikacja jest pojedynczym frontendem React/Vite. Logika UI, telemetrii i sterowania została skupiona praktycznie w jednym komponencie (`src/App.tsx`), który:

- utrzymuje połączenie WebSocket z ROS bridge (`ROSLIB.Ros`),
- subskrybuje i publikuje tematy ROS bez warstwy pośredniej,
- zawiera jednocześnie logikę krytyczną (sterowanie ruchem) i prezentacyjną (dashboard 3D/wykresy),
- posiada wiele funkcji symulowanych/mokowanych (kamera snapshot, taski, footsteps), które wyglądają jak „produkcyjne”.

To jest dobra baza demonstracyjna, ale w realnym robocie wymaga twardego rozdzielenia warstw i mechanizmów bezpieczeństwa.

## 2. Elementy wysokiego ryzyka przy połączeniu z prawdziwym G1

### 2.1. Twardo zakodowane endpointy i tematy ROS

- URL bridge jest ustawiony domyślnie na `ws://localhost:9090`.
- Tematy są wpisane „na sztywno” (`/cmd_vel`, `/joint_states`, `/battery_state`, `/scan`, `/utlidar/cloud`, `/odom`, konkretne nazwy kamer).

**Ryzyko:** na rzeczywistym G1 namespace, nazwy topiców i typy mogą się różnić między wersjami firmware/SDK i konfiguracją stacku ROS2.

**Rozwiązanie:**
- dodać warstwę konfiguracji robota (profile: sim / G1-EDU / custom),
- wykonać mapowanie topiców i typów wiadomości z jednego miejsca,
- dodać „startup diagnostics” weryfikujący obecność wymaganych tematów przed odblokowaniem sterowania.

---

### 2.2. Brak dedykowanej warstwy bezpieczeństwa sterowania

Ruch jest publikowany bezpośrednio na `/cmd_vel` z klawiatury i przycisków, bez watchdoga, dead-man switch i bez potwierdzenia stanu kontrolera robota.

**Ryzyko:** utrata focusu okna, lagi sieciowe lub błędna sekwencja eventów może zostawić robota w ruchu lub wysłać niezamierzone komendy.

**Rozwiązanie:**
- wprowadzić backend „control gateway” (Node/Python/C++) między UI a robotem,
- implementować watchdog (np. wymagany heartbeat 10 Hz, inaczej auto-stop),
- dodać ograniczenia prędkości/akceleracji i filtrację komend,
- wymusić dead-man switch (np. trzymanie klawisza aktywacji ruchu),
- dodać sprzętowo-niezależny kanał E-Stop (topic/service + fizyczny E-Stop).

---

### 2.3. Potencjalne wycieki subskrypcji i duplikacja callbacków

Subskrypcje tworzone po `connection` (bateria, jointy, rosout, lidar, odom) nie są jawnie odpinane przy reconnectach, a tworzone obiekty topic nie są trzymane w rejestrze.

**Ryzyko:** po kilku reconnectach callbacki mogą się dublować, dając lawinę logów i obciążenie CPU/UI.

**Rozwiązanie:**
- utworzyć `RosConnectionManager` trzymający rejestr aktywnych subskrypcji i publisherów,
- przy `close/error/reconnect` wykonywać pełny cleanup (`unsubscribe`),
- dodać idempotentne `connect/disconnect`.

---

### 2.4. Niepełna obsługa danych lidar/czujników

- `PointCloud2` jest tylko logowany (bez dekodowania),
- fallback na `/scan` zakłada `LaserScan`,
- brak synchronizacji ramek (`tf2`) i walidacji frame_id.

**Ryzyko:** mapa i pozycja będą niezgodne z rzeczywistością, co przy G1 może dać błędne decyzje operatora.

**Rozwiązanie:**
- wprowadzić dekoder PointCloud2 po stronie backendu i przesyłać do UI format uproszczony,
- dodać walidację `frame_id` i spójności z `tf` (`map/odom/base_link`),
- dodać kontrolę jakości danych (rate, dropout, latency).

---

### 2.5. Upraszczanie kinematyki/orientacji

Yaw wyliczany z kwaternionu w uproszczony sposób (`2 * atan2(z, w)`).

**Ryzyko:** przy przechyłach/pochyleniu humanoida wynik może być błędny.

**Rozwiązanie:**
- użyć pełnej konwersji quaternion -> RPY,
- rozdzielić orientację 2D (nawigacja) od 3D (stabilność/diagnostyka).

---

### 2.6. Komendy manipulatora i trybów są „demo-level”

- Komenda ramienia publikowana jako pojedynczy `Float64` bez indeksu jointa, limitów i potwierdzeń.
- Zmiana trybu pracy przez prosty `std_msgs/String`.

**Ryzyko:** niezgodność z realnym interfejsem G1 oraz brak gwarancji bezpiecznych przejść stanów.

**Rozwiązanie:**
- użyć oficjalnych interfejsów Unitree (actions/services/topics) przez adapter,
- wdrożyć state machine po stronie gateway: `Standby -> Ready -> Manual -> Auto` z guardami,
- wymagać ACK/NACK i timeoutów.

---

### 2.7. Brak separacji „UI realtime” od „robot control realtime”

Cała logika wykonuje się w przeglądarce i jest zależna od wydajności renderu (3D, wykresy, eventy).

**Ryzyko:** drop FPS w UI wpływa na pętlę sterowania (opóźnienia i jitter komend).

**Rozwiązanie:**
- sterowanie przenieść do procesu backendowego o deterministycznym loopie,
- UI zostawić jako klient HMI (wysyła intencje, nie surowe komendy RT),
- użyć kanału telemetrii z buforowaniem i throttlingiem.

---

### 2.8. Brak hardeningu sieciowego

- domyślnie zwykły `ws://`,
- brak authN/authZ i ról operatora,
- brak audytu komend (kto, kiedy, co wysłał).

**Ryzyko:** podatność na nieautoryzowane sterowanie robotem.

**Rozwiązanie:**
- `wss://` + reverse proxy + mTLS/VPN,
- tokeny sesyjne i role (viewer/operator/supervisor),
- audit log komend i krytycznych zmian trybu.

## 3. Proponowana architektura docelowa

1. **Frontend (React)** – tylko HMI, wizualizacja, workflow operatora.
2. **Control Gateway (nowy komponent)** – walidacja, safety guards, state machine, mapping topiców, rate limiting.
3. **Robot Adapter (Unitree G1)** – cienka warstwa do oficjalnego SDK/ROS2 interfejsów producenta.
4. **Safety Supervisor** – watchdog, heartbeat, E-Stop, monitoring QoS i opóźnień.
5. **Telemetry Pipeline** – normalizacja danych do UI (stabilne schema + wersjonowanie).

## 4. Plan wdrożenia (iteracyjny)

### Faza 1 — „Bezpieczne połączenie”
- Dodać profile konfiguracji topiców i endpointów.
- Dodać diagnostykę startową i blokadę sterowania przy brakach.
- Uporządkować lifecycle subskrypcji (cleanup/reconnect).

### Faza 2 — „Safety first”
- Wprowadzić gateway + watchdog + dead-man switch.
- Ograniczenia prędkości/akceleracji i timeout komend.
- Potwierdzanie zmian trybu (ACK/NACK).

### Faza 3 — „Produkcyjna telemetria”
- Dekodowanie PointCloud2 po backendzie, walidacja `tf`.
- Normalizacja strumieni i kontrola jakości danych.
- Audyt, role użytkowników, szyfrowanie transportu.

## 5. Kryteria gotowości do testu na realnym robocie

- Test HIL przechodzi scenariusze: utrata sieci, reconnect, lag 500ms, packet loss.
- Każda komenda ruchu ma timeout i jest śledzona (trace ID).
- E-Stop działa niezależnie od UI i zatrzymuje ruch < 200 ms.
- Dashboard nie traci responsywności przy pełnej telemetrii (kamera + lidar + jointy).

## 6. Podsumowanie

Największy problem obecnej wersji to brak warstwy pośredniej bezpieczeństwa pomiędzy UI a realnym robotem. Kluczowe jest oddzielenie HMI od sterowania realtime i wdrożenie mechanizmów safety (watchdog, state machine, ACK/NACK, E-Stop), zanim system zostanie podłączony do fizycznego Unitree G1 EDU.
