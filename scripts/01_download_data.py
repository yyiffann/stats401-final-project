"""
Step 1 - download raw data (reproducible, no API key needed).

Sources (all public; pulled from GitHub mirrors of the official releases):
  * World Bank World Development Indicators (WDI)
      official : https://databank.worldbank.org/source/world-development-indicators
      mirror   : https://github.com/open-numbers/ddf--open_numbers--world_development_indicators
  * UNDP Human Development Report 2023/24, composite indices time series (1990-2022)
      official : https://hdr.undp.org/data-center/documentation-and-downloads
      mirror   : https://github.com/openwashdata/undpcomposite
  * World Happiness Report ladder score via Gapminder Fasttrack (validation only)
      mirror   : https://github.com/open-numbers/ddf--gapminder--fasttrack
  * Natural Earth 1:110m country boundaries, TopoJSON (world-atlas@2)
      https://github.com/topojson/world-atlas

Run from the repo root:   python scripts/01_download_data.py
"""
import pathlib
import urllib.request

RAW = pathlib.Path(__file__).resolve().parents[1] / "data" / "raw"

WDI = ("https://raw.githubusercontent.com/open-numbers/"
       "ddf--open_numbers--world_development_indicators/master")

# mirror file id -> official WDI code (meaning)
WDI_INDICATORS = {
    "ny_gdp_pcap_pp_kd":    "NY.GDP.PCAP.PP.KD",     # GDP per capita, PPP, constant 2021 intl $
    "sp_pop_totl":          "SP.POP.TOTL",           # population
    "sp_dyn_le00_in":       "SP.DYN.LE00.IN",        # life expectancy at birth (years)
    "sh_dyn_mort":          "SH.DYN.MORT",           # under-5 mortality (per 1,000 live births)
    "sl_uem_totl_zs":       "SL.UEM.TOTL.ZS",        # unemployment (% labour force, ILO modelled)
    "sl_emp_vuln_zs":       "SL.EMP.VULN.ZS",        # vulnerable employment (% of employment)
    "sh_h2o_basw_zs":       "SH.H2O.BASW.ZS",        # at least basic drinking water (% pop)
    "sh_sta_bass_zs":       "SH.STA.BASS.ZS",        # at least basic sanitation (% pop)
    "eg_elc_accs_zs":       "EG.ELC.ACCS.ZS",        # access to electricity (% pop)
    "en_atm_pm25_mc_m3":    "EN.ATM.PM25.MC.M3",     # PM2.5 mean annual exposure (ug/m3)
    "en_ghg_co2_pc_ce_ar5": "EN.GHG.CO2.PC.CE.AR5",  # CO2 per capita (t CO2e)
}

FILES = {f"wdi/{k}.csv": f"{WDI}/datapoints/ddf--datapoints--{k}--by--geo--time.csv"
         for k in WDI_INDICATORS}
FILES.update({
    "countries_meta.csv": f"{WDI}/ddf--entities--geo--country.csv",
    "undp/HDR23-24_Composite_indices_complete_time_series.csv":
        "https://raw.githubusercontent.com/openwashdata/undpcomposite/main/"
        "data-raw/HDR23-24_Composite_indices_complete_time_series.csv",
    "gapminder/hapiscore_whr.csv":
        "https://raw.githubusercontent.com/open-numbers/ddf--gapminder--fasttrack/master/"
        "countries_etc_datapoints/ddf--datapoints--hapiscore_whr--by--country--time.csv",
    "geo/countries-110m.json":
        "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json",
})

if __name__ == "__main__":
    for rel, url in FILES.items():
        out = RAW / rel
        out.parent.mkdir(parents=True, exist_ok=True)
        urllib.request.urlretrieve(url, out)
        print(f"ok  {rel:62s} {out.stat().st_size/1024:8.1f} KB")
