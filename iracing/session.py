def calculer_session(ir, data):
    def get_val(key, default=0):
        try:
            value = ir[key]
            return default if value is None else value
        except Exception:
            return default

    if not ir.is_connected:
        data["session"] = "Déconnecté"
        data["sessionType"] = "Inconnu"
        return data

    session_num = get_val("SessionNum", 0)
    session_state = get_val("SessionState", 0)
    session_unique_id = get_val("SessionUniqueID", 0)

    try:
        session_num = int(session_num)
    except Exception:
        session_num = 0

    try:
        session_state = int(session_state)
    except Exception:
        session_state = 0

    # Type de session issu des métadonnées préparées par data.py
    type_final = data.get("session_type") or "Practice"

    previous_num = data.get("_last_session_num")
    previous_unique_id = data.get("_last_session_unique_id")
    session_changed = False

    if previous_num is not None:
        if session_num != previous_num or session_unique_id != previous_unique_id:
            session_changed = True

    data["_last_session_num"] = session_num
    data["_last_session_unique_id"] = session_unique_id
    data["session_changed"] = session_changed

    data["sessionType"] = type_final
    data["session_num"] = session_num

    session_states = {
        0: "Invalid",
        1: "Get In Car",
        2: "Warmup",
        3: "Parade Laps",
        4: "Racing",
        5: "Checkered",
        6: "Cool Down",
    }

    data["session_status"] = session_states.get(session_state, "Unknown")

    on_pit_road = get_val("OnPitRoad", False)
    data["session"] = "Pit Lane" if on_pit_road else type_final

    # Temps restant
    raw_remain = get_val("SessionTimeRemain", 0)
    try:
        raw_remain = float(raw_remain)
    except Exception:
        raw_remain = 0.0

    data["session_time_remain"] = raw_remain

    if 0 < raw_remain <= 86400:
        total_seconds = int(raw_remain)
        hours, remainder = divmod(total_seconds, 3600)
        minutes, seconds = divmod(remainder, 60)
        data["session_time_str"] = f"{hours:02d}:{minutes:02d}:{seconds:02d}"
    else:
        data["session_time_str"] = "--:--:--"

    # Position & Carburant
    data["pos"] = get_val("PlayerCarClassPosition", 0)
    data["pos_max"] = get_val("SessionNumEntries", 0)
    data["lap"] = get_val("Lap", 0)

    fuel_now = float(get_val("FuelLevel", 0.0))
    fuel_max = float(get_val("FuelCapacity", 0.0))

    data["fuel"] = round(fuel_now, 1)
    data["fuel_pct"] = round((fuel_now / fuel_max) * 100, 1) if fuel_max > 0 else 0

    return data