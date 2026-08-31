from collections import deque

# --- VARIABLES GLOBALES EN RAM ---
_last_lap = None
_fuel_at_start_of_lap = None
_fuel_history = deque(maxlen=5)
_last_conso = 0.0
_last_print_time = 0.0  # Pour contrôler la fréquence du print


def calculer_voiture(ir, data):
    global _last_lap, _fuel_at_start_of_lap, _fuel_history, _last_conso, _last_print_time

    # ============================================================
    # 🧹 VIDAGE RAM LORS D'UN CHANGEMENT DE SESSION
    # ============================================================
    if data.get("session_changed") or data.get("needs_reset"):
        _last_lap = None
        _fuel_at_start_of_lap = None
        _fuel_history.clear()  # Vide l'historique de consommation
        _last_conso = 0.0
        _last_print_time = 0.0

        # Remet à zéro les clés du dictionnaire
        data["fuel"] = 0.0
        data["fuel_pct"] = 0.0
        data["fuel_per_lap"] = 0.0
        data["fuel_laps_est"] = 0.0
        data["fuel_last_lap"] = 0.0

        print("🧹 [VOITURE] Historique essence et RAM réinitialisés !")

    # ============================================================
    # LECTURE TÉLÉMÉTRIE
    # ============================================================
    if not ir.is_connected:
        return data

    try:
        fuel_actuel = float(ir["FuelLevel"] or 0.0)
        fuel_cap = float(ir["FuelCapacity"] or 50.0)
        lap_termine = int(ir["LapCompleted"] or 0)

        # Détection du tout premier tour de la session
        if _last_lap is None:
            _last_lap = lap_termine
            _fuel_at_start_of_lap = fuel_actuel

        # Calcul de la consommation au passage sur la ligne de départ/arrivée
        if lap_termine > _last_lap:
            conso_tour = _fuel_at_start_of_lap - fuel_actuel

            # Sécurité pour éviter d'enregistrer une conso négative (ex: si tu as fait un pit stop)
            if conso_tour > 0:
                _last_conso = conso_tour
                _fuel_history.append(conso_tour)

            _fuel_at_start_of_lap = fuel_actuel
            _last_lap = lap_termine

        moyenne = (
            sum(_fuel_history) / len(_fuel_history) if _fuel_history else 0.0
        )
        tours_possibles = (
            fuel_actuel / moyenne if moyenne > 0 else 0.0
        )
        fuel_pct = fuel_actuel / fuel_cap if fuel_cap > 0 else 0.0

        # Injection des données
        data["fuel"] = round(fuel_actuel, 2)
        data["fuel_pct"] = round(fuel_pct, 3)
        data["fuel_per_lap"] = round(moyenne, 3)
        data["fuel_laps_est"] = round(tours_possibles, 1)
        data["fuel_last_lap"] = round(_last_conso, 3)

        data["water_temp"] = float(ir["WaterTemp"] or 0.0)
        data["oil_temp"] = float(ir["OilTemp"] or 0.0)
        data["voltage"] = float(ir["Voltage"] or 0.0)

    except Exception as e:
        print(f"⚠️ ERREUR VOITURE: {e}")

    return data