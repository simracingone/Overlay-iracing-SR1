import os

SAVE_FOLDER = "assets/cars"


# ============================================================
# SAUVEGARDE DES MARQUES / MODELES DE VOITURES
# ============================================================

def debug_save_car_brands(drivers):

    if not os.path.exists(SAVE_FOLDER):
        try:
            os.makedirs(SAVE_FOLDER)
        except Exception:
            return

    for d in drivers:

        if not isinstance(d, dict):
            continue

        car_id = d.get("CarID")
        car_name = d.get("CarScreenName")

        if car_id is None or not car_name:
            continue

        path = os.path.join(
            SAVE_FOLDER,
            f"{car_id}.txt"
        )

        if os.path.exists(path):
            continue

        try:

            with open(
                path,
                "w",
                encoding="utf-8"
            ) as f:

                f.write(str(car_name))

        except Exception:
            pass


# ============================================================
# FORMATAGE DES TEMPS
# ============================================================

def _format_time(seconds):

    try:
        seconds = float(seconds)

    except (TypeError, ValueError):
        return "--:--.---"

    if seconds <= 0 or seconds > 3600:
        return "--:--.---"

    mins = int(seconds // 60)
    secs = seconds % 60

    return f"{mins}:{secs:06.3f}"


# ============================================================
# LISTE SECURISEE
# ============================================================

def _safe_list(value, size=64, default=0):

    if isinstance(value, (list, tuple)):
        return list(value)

    return [default] * size


# ============================================================
# LECTURE SECURISEE DU SDK
# ============================================================

def _read(ir, name, default=None):

    try:

        value = ir[name]

        return default if value is None else value

    except Exception:
        return default


# ============================================================
# LEADERBOARD
# ============================================================

def classement(ir, data):

    # ========================================================
    # RESET LORS D'UN CHANGEMENT DE SESSION
    # ========================================================

    if (
        data.get("session_changed")
        or data.get("needs_reset")
    ):

        data["Leaderboard"] = []
        data["Relative"] = []


    # ========================================================
    # VERIFICATION SDK
    # ========================================================

    try:

        if not ir.is_connected:
            return data

    except Exception:
        return data


    # ========================================================
    # PILOTES
    # ========================================================

    d_info = _read(
        ir,
        "DriverInfo",
        {}
    )

    drivers = (
        d_info.get("Drivers", [])
        if isinstance(d_info, dict)
        else []
    )

    if not drivers:

        data["Leaderboard"] = []
        data["Relative"] = []

        return data

    debug_save_car_brands(drivers)


    # ========================================================
    # INDEX DU PILOTE
    # ========================================================

    driver_idx = data.get(
        "DriverCarIdx"
    )

    if driver_idx is None:

        driver_idx = data.get(
            "PlayerCarIdx"
        )

    try:

        driver_idx = (
            int(driver_idx)
            if driver_idx is not None
            else None
        )

    except Exception:

        driver_idx = None


    # ========================================================
    # RESULTATS HISTORIQUES
    #
    # Permet de récupérer les chronos réalisés AVANT
    # la connexion de l'overlay.
    # ========================================================

    session_info = _read(
        ir,
        "SessionInfo",
        {}
    )

    historical_results = {}

    if isinstance(session_info, dict):

        sessions = session_info.get(
            "Sessions",
            []
        )

        if isinstance(sessions, list):

            current_session_num = _read(
                ir,
                "SessionNum",
                None
            )

            current_session = None

            # ------------------------------------------------
            # Recherche de la session courante
            # ------------------------------------------------

            for session in sessions:

                if not isinstance(
                    session,
                    dict
                ):
                    continue

                session_num = session.get(
                    "SessionNum"
                )

                try:

                    if (
                        current_session_num is not None
                        and session_num is not None
                        and int(session_num)
                        == int(current_session_num)
                    ):

                        current_session = session
                        break

                except Exception:

                    if session_num == current_session_num:

                        current_session = session
                        break


            # ------------------------------------------------
            # Résultats de session
            # ------------------------------------------------

            if current_session:

                results_positions = (
                    current_session.get(
                        "ResultsPositions",
                        []
                    )
                )

                if isinstance(
                    results_positions,
                    list
                ):

                    for result in results_positions:

                        if not isinstance(
                            result,
                            dict
                        ):
                            continue

                        try:

                            car_idx_result = int(
                                result.get(
                                    "CarIdx",
                                    -1
                                )
                            )

                        except Exception:

                            continue

                        if car_idx_result < 0:
                            continue

                        historical_results[
                            car_idx_result
                        ] = result


    # ========================================================
    # TELEMETRIE LIVE
    # ========================================================

    est_times = _safe_list(
        _read(
            ir,
            "CarIdxEstTime",
            None
        ),
        64,
        0.0
    )

    class_pos = _safe_list(
        _read(
            ir,
            "CarIdxClassPosition",
            None
        ),
        64,
        0
    )

    pos_array = _safe_list(
        _read(
            ir,
            "CarIdxPosition",
            None
        ),
        64,
        0
    )

    lap_dist = _safe_list(
        _read(
            ir,
            "CarIdxLapDistPct",
            None
        ),
        64,
        0.0
    )

    last_laps = _safe_list(
        _read(
            ir,
            "CarIdxLastLapTime",
            None
        ),
        64,
        0.0
    )

    best_laps = _safe_list(
        _read(
            ir,
            "CarIdxBestLapTime",
            None
        ),
        64,
        0.0
    )

    f3_times = _safe_list(
        _read(
            ir,
            "CarIdxF3Time",
            None
        ),
        64,
        0.0
    )


    # ========================================================
    # INCIDENTS
    # ========================================================

    incidents = _read(
        ir,
        "PlayerCarDriverIncidentCount",
        None
    )

    if incidents is not None:
        data["incidents"] = incidents


    # ========================================================
    # DISTANCE DU PILOTE
    # ========================================================

    my_dist = 0.0

    if (
        driver_idx is not None
        and 0 <= driver_idx < len(lap_dist)
    ):

        try:

            my_dist = float(
                lap_dist[driver_idx]
            )

        except Exception:

            my_dist = 0.0


    # ========================================================
    # CONSTRUCTION DU LEADERBOARD
    # ========================================================

    all_drivers = []

    for d in drivers:

        if not isinstance(
            d,
            dict
        ):
            continue


        # ----------------------------------------------------
        # INDEX VOITURE
        # ----------------------------------------------------

        try:

            idx = int(
                d.get(
                    "CarIdx",
                    -1
                )
            )

        except Exception:

            continue

        if (
            idx < 0
            or idx >= 64
            or d.get("UserName")
            == "Pace Car"
        ):

            continue


        # ----------------------------------------------------
        # POSITION
        # ----------------------------------------------------

        position = (
            class_pos[idx]
            if (
                idx < len(class_pos)
                and class_pos[idx] > 0
            )
            else pos_array[idx]
        )

        if position <= 0:
            position = 999


        # ----------------------------------------------------
        # POSITION DE DEPART / GAIN
        # ----------------------------------------------------

        start_pos = (
            int(
                d.get(
                    "StartingPosition",
                    0
                )
                or 0
            )
            + 1
        )

        gain = (
            start_pos - position
            if position < 999
            else 0
        )


        # ----------------------------------------------------
        # DISTANCE SUR LE TOUR
        # ----------------------------------------------------

        try:

            dist = float(
                lap_dist[idx]
            )

        except Exception:

            dist = 0.0


        # ----------------------------------------------------
        # DISTANCE RELATIVE
        #
        # Valeur comprise entre -0.5 et +0.5 tour.
        #
        # + = devant
        # - = derrière
        # ----------------------------------------------------

        diff = dist - my_dist

        if diff < -0.5:
            diff += 1.0

        elif diff > 0.5:
            diff -= 1.0


        # ====================================================
        # CHRONOS LIVE
        # ====================================================

        try:

            best = float(
                best_laps[idx]
            )

        except Exception:

            best = 0.0

        try:

            last = float(
                last_laps[idx]
            )

        except Exception:

            last = 0.0


        # ====================================================
        # FALLBACK HISTORIQUE
        # ====================================================

        historical = historical_results.get(
            idx
        )

        if historical:

            historical_best = (
                historical.get(
                    "FastestTime",
                    0
                )
                or 0
            )

            historical_last = (
                historical.get(
                    "LastTime",
                    0
                )
                or 0
            )

            try:

                historical_best = float(
                    historical_best
                )

            except (
                TypeError,
                ValueError
            ):

                historical_best = 0.0

            try:

                historical_last = float(
                    historical_last
                )

            except (
                TypeError,
                ValueError
            ):

                historical_last = 0.0


            if (
                best <= 0
                and historical_best > 0
            ):

                best = historical_best


            if (
                last <= 0
                and historical_last > 0
            ):

                last = historical_last


        # ====================================================
        # INFORMATIONS PILOTE
        # ====================================================

        try:

            irating = float(
                d.get(
                    "IRating",
                    0
                )
                or 0
            )

        except Exception:

            irating = 0.0


        car_class_id = (
            d.get(
                "CarClassID",
                0
            )
            or 0
        )

        is_player = (
            driver_idx is not None
            and idx == driver_idx
        )


        # ====================================================
        # AJOUT PILOTE
        # ====================================================

        all_drivers.append(
            {
                "CarIdx": idx,

                "CarID": d.get(
                    "CarID",
                    0
                ) or 0,

                "Position": position,

                "Gain": gain,

                "UserName": d.get(
                    "UserName",
                    "---"
                ),

                "UserID": d.get(
                    "UserID"
                ),

                "Country": (
                    d.get(
                        "FlairName"
                    )
                    or "---"
                ),

                "CountryID": (
                    d.get(
                        "FlairID"
                    )
                    or 0
                ),

                "CarName": d.get(
                    "CarScreenName",
                    "---"
                ),

                "CarNumber": d.get(
                    "CarNumber",
                    "0"
                ),

                "IR_Display": (
                    f"{irating / 1000:.1f}k"
                    if irating > 0
                    else "IA"
                ),

                "LicString": d.get(
                    "LicString",
                    "R 0.00"
                ),

                "BestLapTime": _format_time(
                    best
                ),

                "BestLapTime_raw": best,

                "IsPlayer": is_player,

                "CarClassID": car_class_id,

                "CarClassShortName": d.get(
                    "CarClassShortName",
                    "---"
                ),

                # --------------------------------------------
                # Temps utilisé pour les écarts du leaderboard
                # --------------------------------------------

                "TimeVal": (
                    f3_times[idx]
                    if (
                        idx < len(f3_times)
                        and f3_times[idx] > 0
                    )
                    else est_times[idx]
                ),

                # --------------------------------------------
                # Distance relative brute
                # --------------------------------------------

                "RelativeDiff": diff,

                # --------------------------------------------
                # Chrono dernier tour
                # --------------------------------------------

                "LastLapTime": _format_time(
                    last
                ),

                "LastLapTime_raw": last,

                # --------------------------------------------
                # Sera recalculé correctement plus bas
                # --------------------------------------------

                "GapRelat": "---",

                "Gap": "---",

                "GapInt": "---",
            }
        )


    # ========================================================
    # AUCUN PILOTE
    # ========================================================

    if not all_drivers:

        data["Leaderboard"] = []
        data["Relative"] = []

        return data


    # ========================================================
    # TRI LEADERBOARD
    # ========================================================

    all_drivers.sort(
        key=lambda x: (
            x["CarClassID"],
            x["Position"],
            x["CarIdx"]
        )
    )


    # ========================================================
    # CALCUL DES GAPS DU LEADERBOARD
    # ========================================================

    leaders = {}

    for i, p in enumerate(
        all_drivers
    ):

        class_id = p[
            "CarClassID"
        ]

        try:

            t = float(
                p["TimeVal"]
                or 0
            )

        except Exception:

            t = 0.0


        # ----------------------------------------------------
        # LEADER DE CLASSE
        # ----------------------------------------------------

        if p["Position"] == 1:

            p["Gap"] = "LDR"

            leaders[
                class_id
            ] = t


        elif (
            class_id in leaders
            and t > 0
        ):

            gap = (
                t
                - leaders[class_id]
            )

            p["Gap"] = (
                f"+{max(0, gap):.1f}s"
            )


        # ----------------------------------------------------
        # ECART AVEC LE PILOTE PRECEDENT
        # ----------------------------------------------------

        if i > 0:

            prev = all_drivers[
                i - 1
            ]

            if (
                prev["CarClassID"]
                == class_id
            ):

                try:

                    prev_t = float(
                        prev["TimeVal"]
                        or 0
                    )

                except Exception:

                    prev_t = 0.0

                gap_int = (
                    t
                    - prev_t
                )

                p["GapInt"] = (
                    f"+{max(0, gap_int):.1f}s"
                )


    # ========================================================
    # LEADERBOARD FINAL
    # ========================================================

    data["Leaderboard"] = sorted(
        all_drivers,
        key=lambda x: (
            x["Position"],
            x["CarClassID"],
            x["CarIdx"]
        )
    )


    # ========================================================
    # RELATIF
    #
    # IMPORTANT :
    #
    # Le relatif ne doit PAS être construit en triant tout
    # le monde simplement sur RelativeDiff.
    #
    # On part du joueur puis on cherche :
    #
    #     3 voitures devant
    #     JOUEUR
    #     3 voitures derrière
    #
    # La distance sur le circuit détermine qui est autour
    # du joueur.
    # ========================================================

    player = next(
        (
            p
            for p in all_drivers
            if p["IsPlayer"]
        ),
        None
    )


    if player is None:

        data["Relative"] = []

        return data


    # ========================================================
    # CALCUL DES ECARTS RELATIFS
    # ========================================================

    devant = []
    derriere = []


    for p in all_drivers:

        if p["IsPlayer"]:
            continue


        # ----------------------------------------------------
        # Distance autour du circuit
        # ----------------------------------------------------

        try:

            relative_diff = float(
                p["RelativeDiff"]
            )

        except Exception:

            continue


        # ----------------------------------------------------
        # Conversion en distance "devant / derrière"
        #
        # + = devant
        # - = derrière
        # ----------------------------------------------------

        if relative_diff > 0:

            devant.append(p)

        else:

            derriere.append(p)


    # ========================================================
    # TRI DES VOITURES DEVANT
    #
    # La voiture la plus proche doit être en premier.
    # ========================================================

    devant.sort(
        key=lambda p: p["RelativeDiff"]
    )


    # ========================================================
    # TRI DES VOITURES DERRIERE
    #
    # La voiture la plus proche doit être en premier.
    # ========================================================

    derriere.sort(
        key=lambda p: abs(
            p["RelativeDiff"]
        )
    )


    # ========================================================
    # ECART RELATIF EN SECONDES
    #
    # CarIdxEstTime représente une estimation temporelle
    # en secondes pour atteindre la position actuelle.
    #
    # On utilise cette valeur pour afficher un vrai écart
    # temporel plutôt que de transformer arbitrairement un
    # pourcentage de tour en secondes.
    # ========================================================

    try:

        player_est_time = float(
            est_times[
                player["CarIdx"]
            ]
        )

    except Exception:

        player_est_time = 0.0


    for p in devant + derriere:

        try:

            car_est_time = float(
                est_times[
                    p["CarIdx"]
                ]
            )

        except Exception:

            car_est_time = 0.0


        if (
            player_est_time > 0
            and car_est_time > 0
        ):

            gap_seconds = abs(
                car_est_time
                - player_est_time
            )

            p["GapRelat"] = (
                f"+{gap_seconds:.1f}s"
            )

        else:

            p["GapRelat"] = "---"


    # ========================================================
    # RELATIF FINAL
    #
    # 3 DEVANT
    # JOUEUR
    # 3 DERRIERE
    # ========================================================

    data["Relative"] = (
        devant[:3]
        + [player]
        + derriere[:3]
    )


    # ========================================================
    # SECURITE
    #
    # Le joueur doit toujours rester au centre du relatif.
    # ========================================================

    if player not in data["Relative"]:

        data["Relative"] = [
            player
        ]


    return data