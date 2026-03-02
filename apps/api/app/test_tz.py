import sys
try:
    import zoneinfo
    tz = zoneinfo.ZoneInfo("Europe/Istanbul")
    print("ZoneInfo Success:", tz)
except Exception as e:
    print("ZoneInfo Error:", e)

try:
    import pytz
    tz2 = pytz.timezone("Europe/Istanbul")
    print("Pytz Success:", tz2)
except Exception as e:
    print("Pytz Error:", e)
