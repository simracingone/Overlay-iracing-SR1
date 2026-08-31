import time
import irsdk

from iracing.flags import FlagState, compute_flags
from iracing.meteo import calculer_meteo
from iracing.voiture import calculer_voiture
from iracing.performance import calculer_performance
from iracing.session import calculer_session
from iracing.pneus import calculer_pneus
from iracing.classement import classement


# ============================================================
# CONFIG
# ============================================================

VERSION = "5.2.0"
DEBUG_SESSION = True
SDK_RECONNECT_DELAY = 5.0


# ============================================================
# SDK & CACHE
# ============================================================

ir = irsdk.IRSDK()

was_connected = False
sdk_state = "DISCONNECTED"
sdk_reconnect_until = 0.0

# Variables de cache
last_config_key = None
last_session_info_update = None
last_session_num = None
last_session_unique_id = None

cached_session_info = None
cached_driver_info = None
cached_weekend = None

session_generation = 0


# ============================================================
# FLAGS
# ============================================================

flag_state = FlagState()


# ============================================================
# OUTILS
# ============================================================

def _read(name, default=None):
    try:
        value = ir[name]
        return default if value is None else value
    except Exception:
        return default


def _clean(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value if value else None
    return value


def _dict(value):
    return value if isinstance(value, dict) else {}


# ============================================================
# ÉTAT SDK & CONNEXION
# ============================================================

def _set_sdk_state(state):
    global sdk_state
    if sdk_state == state:
        return
    sdk_state = state
    if state == "CONNECTED":
        print("✅ SDK iRacing connecté.")
    elif state == "DISCONNECTED":
        print("🔴 SDK iRacing déconnecté.")
    elif state == "CONNECTING":
        print("🔌 Connexion au SDK iRacing...")


def _connect():
    global ir, was_connected, sdk_reconnect_until

    now = time.monotonic()

    # Déjà connecté
    try:
        if ir.is_connected:
            if not was_connected:
                was_connected = True
                _set_sdk_state("CONNECTED")
            return True
    except Exception as e:
        print(f"⚠️ Vérification SDK impossible : {type(e).__name__}: {e}")

    # Temporisation avant nouvelle tentative
    if now < sdk_reconnect_until:
        return False

    _set_sdk_state("CONNECTING")

    try:
        # On recrée systématiquement l'instance si elle n'est plus valide
        try:
            ir.shutdown()
        except Exception:
            pass

        ir = irsdk.IRSDK()

        if not ir.startup():
            was_connected = False
            sdk_reconnect_until = time.monotonic() + SDK_RECONNECT_DELAY
            _set_sdk_state("DISCONNECTED")
            return False

        # Vérification réelle après startup
        if not ir.is_connected:
            was_connected = False
            sdk_reconnect_until = time.monotonic() + SDK_RECONNECT_DELAY
            _set_sdk_state("DISCONNECTED")
            return False

        was_connected = True
        sdk_reconnect_until = 0.0
        _set_sdk_state("CONNECTED")

        return True

    except Exception as e:
        was_connected = False
        sdk_reconnect_until = time.monotonic() + SDK_RECONNECT_DELAY
        print(f"❌ ERREUR SDK: {type(e).__name__}: {e}")
        _set_sdk_state("DISCONNECTED")
        return False


def _sdk_lost():
    global ir, was_connected, sdk_reconnect_until
    global cached_session_info, cached_driver_info, cached_weekend
    global last_session_info_update, last_session_num, last_session_unique_id, last_config_key

    # Invalidation complète du cache
    cached_session_info = None
    cached_driver_info = None
    cached_weekend = None
    last_session_info_update = None
    last_session_num = None
    last_session_unique_id = None
    last_config_key = None

    if not was_connected:
        sdk_reconnect_until = max(sdk_reconnect_until, time.monotonic() + SDK_RECONNECT_DELAY)
        return

    was_connected = False
    _set_sdk_state("DISCONNECTED")

    try:
        if ir.is_connected:
            ir.shutdown()
    except Exception:
        pass

    try:
        ir = irsdk.IRSDK()
    except Exception as e:
        print(f"❌ ERREUR nouvelle instance SDK: {type(e).__name__}: {e}")

    sdk_reconnect_until = time.monotonic() + SDK_RECONNECT_DELAY


# ============================================================
# EXTRACTION DES DONNÉES DE SESSION
# ============================================================

def _get_driver_info(driver_info):
    driver_info = _dict(driver_info)
    driver_idx = _clean(driver_info.get("DriverCarIdx"))

    player = {
        "driver_idx": driver_idx,
        "user_id": _clean(driver_info.get("DriverUserID")),
        "user_name": None,
        "car_number": None,
        "car_path": None,
        "car_id": None,
        "class_id": None,
        "class_name": None,
        "class_color": None,
        "est_lap_time": None,
    }

    drivers = driver_info.get("Drivers", [])
    if not isinstance(drivers, list):
        drivers = []

    selected = None
    if driver_idx is not None:
        for driver in drivers:
            if isinstance(driver, dict) and driver.get("CarIdx") == driver_idx:
                selected = driver
                break

    if selected is None and player["user_id"] is not None:
        for driver in drivers:
            if isinstance(driver, dict) and driver.get("UserID") == player["user_id"]:
                selected = driver
                break

    if selected:
        player["user_id"] = _clean(selected.get("UserID"))
        player["user_name"] = _clean(selected.get("UserName"))
        player["car_number"] = _clean(selected.get("CarNumber"))
        player["car_path"] = _clean(selected.get("CarPath"))
        player["car_id"] = _clean(selected.get("CarID"))
        player["class_id"] = _clean(selected.get("CarClassID"))
        player["class_name"] = _clean(selected.get("CarClassShortName"))
        player["class_color"] = _clean(selected.get("CarClassColor"))
        player["est_lap_time"] = _clean(selected.get("CarClassEstLapTime"))

    # Fallbacks
    if player["user_name"] is None:
        player["user_name"] = _clean(driver_info.get("UserName"))
    if player["car_path"] is None:
        player["car_path"] = _clean(driver_info.get("DriverCarPath"))
    if player["class_id"] is None:
        player["class_id"] = _clean(driver_info.get("DriverCarClassID"))
    if player["class_name"] is None:
        player["class_name"] = _clean(driver_info.get("DriverCarClassShortName"))
    if player["car_number"] is None:
        player["car_number"] = _clean(driver_info.get("DriverCarNumber"))

    return player


def _get_classes(driver_info):
    driver_info = _dict(driver_info)
    result = set()
    drivers = driver_info.get("Drivers", [])
    if not isinstance(drivers, list):
        return []

    for driver in drivers:
        if not isinstance(driver, dict):
            continue
        class_id = driver.get("CarClassID")
        class_name = driver.get("CarClassShortName")
        if class_id is None and not class_name:
            continue
        result.add((str(class_id) if class_id is not None else "", str(class_name or "")))

    return [{"id": item[0], "name": item[1]} for item in sorted(result)]


def _get_session_data(session_info, session_num):
    session_info = _dict(session_info)
    sessions = session_info.get("Sessions", [])
    if not isinstance(sessions, list):
        return {}

    session = {}
    for s in sessions:
        if isinstance(s, dict) and s.get("SessionNum") == session_num:
            session = s
            break

    if not session and sessions:
        session = sessions[0]

    return {
        "num": _clean(session.get("SessionNum")),
        "type": _clean(session.get("SessionType")),
        "name": _clean(session.get("SessionName")),
        "laps": _clean(session.get("SessionLaps")),
        "time": _clean(session.get("SessionTime")),
        "subtype": _clean(session.get("SessionSubType")),
        "skipped": _clean(session.get("SessionSkipped")),
    }


def _get_weekend():
    weekend = _dict(_read("WeekendInfo", {}))
    return {
        "series_id": _clean(weekend.get("SeriesID")),
        "season_id": _clean(weekend.get("SeasonID")),
        "session_id": _clean(weekend.get("SessionID")),
        "subsession_id": _clean(weekend.get("SubSessionID")),
        "track_id": _clean(weekend.get("TrackID")),
        "track": _clean(weekend.get("TrackDisplayName") or weekend.get("TrackName")),
        "track_name": _clean(weekend.get("TrackName")),
        "track_config": _clean(weekend.get("TrackConfigName")),
        "category": _clean(weekend.get("Category")),
        "event_type": _clean(weekend.get("EventType")),
    }


def _build_config_key(weekend, session, player):
    return (
        weekend.get("session_id"),
        weekend.get("subsession_id"),
        weekend.get("series_id"),
        weekend.get("season_id"),
        weekend.get("track_id"),
        weekend.get("track_config"),
        session.get("num"),
        session.get("type"),
        session.get("name"),
        player.get("driver_idx"),
        player.get("car_id"),
        player.get("car_path"),
        player.get("class_id"),
        player.get("class_name"),
    )


def _reset_data(data):
    global flag_state
    data["Leaderboard"] = []
    data["Relative"] = []
    data["tires"] = {}
    data["fuel"] = 0.0
    data["delta"] = 0.0
    data["combined"] = None
    data["flag"] = {}

    data["needs_reset"] = True
    data["session_changed"] = True
    data["force_reload"] = True

    try:
        flag_state = FlagState()
    except Exception:
        pass

    return data


def _new_data():
    return {
        "server": "OK",
        "IsConnected": False,
        "needs_reset": False,
        "session_changed": False,
        "force_reload": False,
        "session": "Déconnecté",
        "session_info_update": None,
        "session_unique_id": None,
        "session_num": None,
        "session_type": None,
        "session_state": None,
        "session_id": None,
        "subsession_id": None,
        "session_generation": 0,
        "series_id": None,
        "season_id": None,
        "track_id": None,
        "track": None,
        "track_name": None,
        "track_config": None,
        "category": None,
        "DriverCarIdx": None,
        "PlayerCarIdx": None,
        "UserName": None,
        "CarNumber": None,
        "CarPath": None,
        "CarID": None,
        "CarClassID": None,
        "CarClassName": None,
        "air_temp": 0.0,
        "track_temp": 0.0,
        "humidity_pct": 0,
        "rain_intensity_pct": 0,
        "track_wetness_pct": 0,
        "tires": {},
        "fuel": 0.0,
        "delta": 0.0,
        "Leaderboard": [],
        "Relative": [],
        "combined": None,
        "flag": {},
    }


# ============================================================
# FONCTION PRINCIPALE (EXECUTION RAPIDE ET RÉACTIVE)
# ============================================================

def get_all_data():
    global last_config_key, last_session_info_update, session_generation
    global last_session_num, last_session_unique_id
    global cached_session_info, cached_driver_info, cached_weekend

    data = _new_data()

    if not _connect():
        data["server"] = "DISCONNECTED"
        data["IsConnected"] = False
        return data

    try:
        # Freeze la télémétrie rapide
        ir.freeze_var_buffer_latest()

        # ----------------------------------------------------
        # VARIABLES RAPIDES (Mémoire partagée direct C-SDK)
        # ----------------------------------------------------
        session_num = _read("SessionNum", None)
        session_type_variable = _read("SessionType", None)
        session_state = _read("SessionState", None)
        session_unique_id = _read("SessionUniqueID", None)
        player_car_idx = _read("PlayerCarIdx", None)
        update = getattr(ir, "session_info_update", None)

        # ----------------------------------------------------
        # DÉTECTION INSTANTANÉE DU CHANGEMENT DE SESSION
        # ----------------------------------------------------
        fast_session_change = (
            (last_session_num is not None and session_num != last_session_num) or
            (last_session_unique_id is not None and session_unique_id != last_session_unique_id)
        )

        yaml_updated = (update is not None and update != last_session_info_update)

        # On re-parse le YAML si changement rapide détecté OR mise à jour YAML OR cache vide
        if fast_session_change or yaml_updated or cached_session_info is None:
            last_session_info_update = update
            last_session_num = session_num
            last_session_unique_id = session_unique_id

            cached_session_info = _dict(_read("SessionInfo", {}))
            cached_driver_info = _dict(_read("DriverInfo", {}))
            cached_weekend = _get_weekend()

        session_info = cached_session_info
        driver_info = cached_driver_info
        weekend = cached_weekend

        # ----------------------------------------------------
        # DÉDUCTIONS & JOUEURS
        # ----------------------------------------------------
        session = _get_session_data(session_info, session_num)
        if session.get("type") is None:
            session["type"] = _clean(session_type_variable)

        player = _get_driver_info(driver_info)

        # ----------------------------------------------------
        # IDENTITÉ DE SESSION ET RESET
        # ----------------------------------------------------
        config_key = _build_config_key(weekend, session, player)

        if last_config_key is None:
            last_config_key = config_key
            session_generation = 1
        elif config_key != last_config_key or fast_session_change:
            last_config_key = config_key
            session_generation += 1
            data = _reset_data(data)

        # ----------------------------------------------------
        # MÉTADONNÉES DE SESSION
        # ----------------------------------------------------
        data["server"] = "OK"
        data["IsConnected"] = True
        data["session_info_update"] = update
        data["session_unique_id"] = session_unique_id
        data["session_num"] = session_num
        data["session_type"] = session.get("type")
        data["session"] = session.get("name") or session.get("type") or "Session"
        data["session_state"] = session_state
        data["session_id"] = weekend.get("session_id")
        data["subsession_id"] = weekend.get("subsession_id")
        data["session_generation"] = session_generation

        # Weekend
        data["series_id"] = weekend.get("series_id")
        data["season_id"] = weekend.get("season_id")
        data["track_id"] = weekend.get("track_id")
        data["track"] = weekend.get("track")
        data["track_name"] = weekend.get("track_name")
        data["track_config"] = weekend.get("track_config")
        data["category"] = weekend.get("category")

        # Joueur
        data["DriverCarIdx"] = player.get("driver_idx")
        data["PlayerCarIdx"] = player_car_idx
        data["UserName"] = player.get("user_name")
        data["CarNumber"] = player.get("car_number")
        data["CarPath"] = player.get("car_path")
        data["CarID"] = player.get("car_id")
        data["CarClassID"] = player.get("class_id")
        data["CarClassName"] = player.get("class_name")

        # ----------------------------------------------------
        # MODULES CALCULÉS
        # ----------------------------------------------------
        try:
            data = calculer_session(ir, data)
        except Exception as e:
            print(f"⚠️ calculer_session: {type(e).__name__}: {e}")

        try:
            data = classement(ir, data)
        except Exception as e:
            print(f"⚠️ classement: {type(e).__name__}: {e}")

        try:
            data = calculer_pneus(ir, data)
        except Exception as e:
            print(f"⚠️ calculer_pneus: {type(e).__name__}: {e}")

        try:
            data = calculer_performance(ir, data)
        except Exception as e:
            print(f"⚠️ calculer_performance: {type(e).__name__}: {e}")

        try:
            data = calculer_meteo(ir, data)
        except Exception as e:
            print(f"⚠️ calculer_meteo: {type(e).__name__}: {e}")

        try:
            data = calculer_voiture(ir, data)
        except Exception as e:
            print(f"⚠️ calculer_voiture: {type(e).__name__}: {e}")

        try:
            combined, flags = compute_flags(ir, flag_state)
            data["combined"] = combined
            data["flag"] = flags
        except Exception as e:
            print(f"⚠️ compute_flags: {type(e).__name__}: {e}")
            data["combined"] = None
            data["flag"] = {}

        return data

    except Exception as e:
        print(f"❌ ERREUR LECTURE DONNÉES: {type(e).__name__}: {e}")
        connected = False
        try:
            connected = bool(ir.is_connected)
        except Exception:
            connected = False

        if connected:
            data["server"] = "ERROR"
            data["IsConnected"] = True
            return data

        data["server"] = "DISCONNECTED"
        data["IsConnected"] = False
        _sdk_lost()
        return data