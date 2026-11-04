# Painel meteorológico — modo consenso

O painel consulta três modelos numéricos independentes pela API Open-Meteo:

- ECMWF IFS 0.25° (`ecmwf_ifs025`)
- NOAA GFS Seamless (`ncep_gfs_seamless`)
- DWD ICON Global (`icon_global`)

As consultas são paralelas. Temperatura atual, sensação térmica e variáveis diárias são consolidadas pela mediana; condição do tempo usa a categoria mais frequente. A faixa de confiança (alta, moderada, baixa ou limitada) representa a concordância entre os modelos, não uma taxa histórica de acerto.

Uma consulta adicional `best_match` mantém a previsão de chuva nas próximas 24 horas e serve como fallback caso os modelos independentes falhem. O cache e a atualização automática de 30 minutos existentes foram preservados.

## Limite importante

Os três modelos são fontes meteorológicas independentes, mas são entregues pelo mesmo provedor de API (Open-Meteo). Não são três empresas/API vendors diferentes. Para integrar OpenWeather ou WeatherAPI com segurança, será necessário um pequeno backend/proxy com as chaves guardadas no servidor; não coloque chaves privadas nos arquivos JavaScript enviados ao navegador. O MET Norway também recomenda acesso por backend, com identificação própria no User-Agent e respeito ao cache/CORS.
