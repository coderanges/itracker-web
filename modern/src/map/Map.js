import 'maplibre-gl/dist/maplibre-gl.css';
import './switcher/switcher.css';
import maplibregl from 'maplibre-gl';
import React, {
  useRef, useLayoutEffect, useEffect, useState,
} from 'react';
import { SwitcherControl } from './switcher/switcher';
import deviceCategories from '../common/deviceCategories';
import { prepareIcon, loadImage } from './mapUtil';
import t, { useLocalization } from '../common/localization';
import {
  styleCarto, styleMapbox, styleMapTiler, styleOsm,
} from './mapStyles';
import { useAttributePreference } from '../common/preferences';
import palette from '../theme/palette';

const element = document.createElement('div');
element.style.width = '100%';
element.style.height = '100%';

export const map = new maplibregl.Map({
  container: element,
  style: styleOsm(),
});

let ready = false;
const readyListeners = new Set();

const addReadyListener = (listener) => {
  readyListeners.add(listener);
  listener(ready);
};

const removeReadyListener = (listener) => {
  readyListeners.delete(listener);
};

const updateReadyValue = (value) => {
  ready = value;
  readyListeners.forEach((listener) => listener(value));
};

const initMap = async () => {
  if (ready) return;
  if (!map.hasImage('background')) {
    const background = await loadImage('images/background.svg');
    map.addImage('background', await prepareIcon(background), {
      pixelRatio: window.devicePixelRatio,
    });
    await Promise.all(deviceCategories.map(async (category) => {
      const results = [];
      ['green', 'red', 'gray'].forEach((color) => {
        results.push(loadImage(`images/icon/${category}.svg`).then((icon) => {
          map.addImage(`${category}-${color}`, prepareIcon(background, icon, palette.common[color]), {
            pixelRatio: window.devicePixelRatio,
          });
        }));
      });
      await Promise.all(results);
    }));
  }
  updateReadyValue(true);
};

map.on('load', initMap);

const switcher = new SwitcherControl(
  [
    { title: t('mapOsm'), uri: styleOsm() },
    { title: t('mapCarto'), uri: styleCarto() },
    { title: t('mapMapboxStreets'), uri: styleMapbox('streets-v11') },
    { title: t('mapMapboxOutdoors'), uri: styleMapbox('outdoors-v11') },
    { title: t('mapMapboxSatellite'), uri: styleMapbox('satellite-v9') },
    { title: t('mapMapTilerBasic'), uri: styleMapTiler('basic', '{mapTilerKey}') },
    { title: t('mapMapTilerHybrid'), uri: styleMapTiler('hybrid', '{mapTilerKey}') },
  ],
  t('mapOsm'),
  () => updateReadyValue(false),
  () => {
    const waiting = () => {
      if (!map.loaded()) {
        setTimeout(waiting, 100);
      } else {
        initMap();
      }
    };
    waiting();
  },
);

const addPrimaryControls = position => {
  map.addControl(navigationControl, position);
  map.addControl(switcher, position);
}

const removePrimaryControls =()=> {
  map.removeControl(navigationControl);
  map.removeControl(switcher);
}


map.addControl(switcher);

const Map = ({ children }) => {
  const containerEl = useRef(null);
  const {direction} = useLocalization();
  const [mapReady, setMapReady] = useState(false);

  const mapboxAccessToken = useAttributePreference('mapboxAccessToken');

  useEffect(()=>{
    const controlsPosition = direction ==='rtl' ? 'top-left' : 'top-right';
    addPrimaryControls(controlsPosition);
    return removePrimaryControls;
  },[direction])

  useEffect(() => {
    maplibregl.accessToken = mapboxAccessToken;
  }, [mapboxAccessToken]);

  const mapTilerKey = useAttributePreference('mapTilerKey');

  useEffect(() => {
    switcher.setVariable('mapTilerKey', mapTilerKey);
  }, [mapTilerKey]);

  useEffect(() => {
    const listener = (ready) => setMapReady(ready);
    addReadyListener(listener);
    return () => {
      removeReadyListener(listener);
    };
  }, []);

  useLayoutEffect(() => {
    const currentEl = containerEl.current;
    currentEl.appendChild(element);
    if (map) {
      map.resize();
    }
    return () => {
      currentEl.removeChild(element);
    };
  }, [containerEl]);

  return (
    <div style={{ width: '100%', height: '100%' }} ref={containerEl}>
      {mapReady && children}
    </div>
  );
};

export default Map;
