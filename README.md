# APIBuild_1.3

API builder for Leaflet version 1.3 

# Пример сборки плагинов Геомиксера

Build
------

[NodeJS](http://nodejs.org/) is required to build the plugin.

```
prepare.sh - обновление модулей для сборки
gulp gmx-pub - подготовка сборок (режим публикации)
```

Подготавливаются следующие сборки в папке `dist`.
Сборка общая:
```
version.js - даты создания файлов (unixTimeStamp в мсек.)
geomixer.js - API минимизированный вариант(содержит: Leaflet-1.3 + необходимые плагины Geomixer)
geomixer-src.js - API в исходном виде
geomixer.css - стилевые таблицы
images - папка иконок Leaflet-1.3
img - папка иконок контролов Geomixer
```

Сборка для мобильных устройств:
```
mobiles.js - API-mobiles минимизированный вариант(содержит: Leaflet-1.3 + Leaflet-Geomixer)
mobiles-src.js - API-mobiles в исходном виде
mobiles.css - стилевые таблицы
images - папка иконок Leaflet-1.3
```

Сборки доступны по адресу:
http://www.kosmosnimki.ru/lib/geomixer_1.3/

Описания видео и вебинары
```
https://vimeo.com/118021607
https://vimeo.com/128115656
https://vimeo.com/127895276
https://www.youtube.com/watch?v=xL4NHc_uEjw
https://www.youtube.com/watch?v=JQ-q4CgVvYE
https://www.youtube.com/watch?v=zm0X1dR85wo
