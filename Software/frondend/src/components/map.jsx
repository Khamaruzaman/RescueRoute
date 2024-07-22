import React, { useRef, useEffect, useState } from "react";
import maplibregl from "maplibre-gl";
import distance from "@turf/distance";
import axios from "axios";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

import { GeocodingControl } from "@maptiler/geocoding-control/react";
import { createMapLibreGlMapController } from "@maptiler/geocoding-control/maplibregl-controller";
import "@maptiler/geocoding-control/style.css";
import { round } from "@turf/turf";

const backend_url = "http://192.168.65.5:5000";

export default function Map() {
  let station_location = null;

  axios
    .get(backend_url + "/station_db")
    .then((response) => {
      station_location = response.data;
    })
    .catch((error) => {
      console.error("Error fetching data from API:", error);
    });

  const [engineList, setEngineList] = useState([]);

  useEffect(() => {
    axios
      .get(backend_url + "/engine_db")
      .then((response) => {
        setEngineList(response.data);
      })
      .catch((error) => {
        console.error("Error fetching engineList data from API:", error);
      });
  }, []);

  const mapContainer = useRef(null);
  const map = useRef(null);
  const [lng] = useState(76.95);
  const [lat] = useState(8.5);
  const [zoom] = useState(13);
  const [API_KEY] = useState("RhjX0mDGqprpkICiETXV");
  const [mapController, setMapController] = useState();
  const [fireEngine, setFireEngine] = useState(null);
  const [clickCoordinates, setClickCoordinates] = useState(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [destination, setDestination] = useState(null);
  const [stationName, setStationName] = useState(null);
  const [pathDistance, setPathDistance] = useState(null);
  const [pathTime, setPathTime] = useState(null);
  const [remainingDist, setRemainingDist] = useState(null);

  const removePath = () => {
    if (map.current.getLayer("path")) {
      map.current.removeLayer("path");
    }
    if (map.current.getSource("path")) {
      map.current.removeSource("path");
    }
    if (map.current.getLayer("walking")) {
      map.current.removeLayer("walking");
    }
    if (map.current.getSource("walking")) {
      map.current.removeSource("walking");
    }
  };

  const createPath = (geojsonData, dest) => {
    removePath();

    map.current.addLayer({
      id: "path",
      type: "line",
      source: {
        type: "geojson",
        data: geojsonData,
      },
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#0000f0",
        "line-width": 5,
        "line-opacity": 0.5,
      },
    });

    const features = geojsonData.features;
    const lastFeature = features[0];
    const lineString = lastFeature.geometry.coordinates;
    const lastCoordinate = lineString[lineString.length - 1];
    const remaining_dist = distance(lastCoordinate, dest, { units: "meters" });

    setRemainingDist(remaining_dist);

    map.current.addSource("walking", {
      type: "geojson",
      data: {
        type: "FeatureCollection",
        features: [
          {
            type: "Feature",
            geometry: {
              type: "LineString",
              coordinates: [lastCoordinate, dest],
            },
            properties: {},
          },
        ],
      },
    });

    map.current.addLayer({
      id: "walking",
      type: "line",
      source: "walking",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#888",
        "line-width": 5,
        "line-dasharray": [1.5, 3],
      },
    });
  };

  const sendData = async (coordinates) => {
    const data = {
      start_x: coordinates[0][0],
      start_y: coordinates[0][1],
      end_x: coordinates[1][0],
      end_y: coordinates[1][1],
      fireEngine: parseFloat(fireEngine[0]),
    };
    console.log(data);
    try {
      const response = await axios.post(backend_url + "/route", data);
      if (response.status === 200) {
        const jsonData = response.data;
        console.log(jsonData);
        createPath(jsonData["geojson"], coordinates[1]);

        setPathDistance(jsonData["distance"]);
        setPathTime(jsonData["time"]);
        setIsDetailsOpen(true);
      } else {
        console.error("Error fetching GeoJSON:", response.statusText);
      }
    } catch (error) {
      console.error("Error sending coordinates:", error);
    }
  };

  const create_route = (end_point_lngLat) => {
    const point1 = {
      type: "Point",
      coordinates: end_point_lngLat,
    };
    var dist = Infinity;
    var Start_point_lngLat;

    for (let i = 0; i < station_location.length; i++) {
      const point2 = {
        type: "Point",
        coordinates: station_location[i][0],
      };
      const distanceInMeters = distance(point1, point2, { units: "meters" });

      if (distanceInMeters < dist) {
        dist = distanceInMeters;
        Start_point_lngLat = station_location[i];
      }
    }

    setDestination(end_point_lngLat);
    setStationName(Start_point_lngLat[1]);

    sendData([Start_point_lngLat[0], end_point_lngLat]);
  };

  useEffect(() => {
    if (map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: `https://api.maptiler.com/maps/streets-v2/style.json?key=${API_KEY}`,
      center: [lng, lat],
      zoom: zoom,
    });

    map.current.addControl(new maplibregl.NavigationControl(), "top-right");

    setMapController(createMapLibreGlMapController(map.current, maplibregl));

    map.current.addControl(
      new maplibregl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
        },
        trackUserLocation: true,
      }),
      "top-right"
    );

    const marker = new maplibregl.Marker({ color: "#ff0000" });

    map.current.on("load", () => {
      for (let i = 0; i < station_location.length; i++) {
        const marker = new maplibregl.Marker()
          .setLngLat(station_location[i][0])
          .addTo(map.current)
          .setPopup(
            new maplibregl.Popup({ offset: 25, closeButton: false }).setHTML(
              `<span style="color: #000000">${station_location[i][1]}</span>`
            )
          );
        const markerDiv = marker.getElement();
        markerDiv.addEventListener("mouseenter", () => marker.togglePopup()); // add popup if hovered on
        markerDiv.addEventListener("mouseleave", () => marker.togglePopup()); // remove popup if not hovered on
        markerDiv.addEventListener("click", () => marker.togglePopup()); // to disable popup on click
      }
    });

    map.current.on("click", (event) => {
      const coordinates = event.lngLat;
      marker.setLngLat(coordinates).addTo(map.current);
      setClickCoordinates(Object.values(coordinates));

      removePath();
      setIsDetailsOpen(false);
    });
  }, [API_KEY, fireEngine, lat, lng, station_location, zoom]);

  const handleChange = (event) => {
    setIsDetailsOpen(false);
    const vehicle = event.target.value;
    if (vehicle) setFireEngine(vehicle.split(","));
    else setFireEngine(null);
    // console.log(vehicle.split(","));
  };

  const handleClick = () => {
    if (!clickCoordinates) {
      console.error("no point selected");
      window.alert("no point selected");
      return;
    }
    if (!fireEngine) {
      console.error("no fire engine selected");
      window.alert("no fire engine selected");
      return;
    }

    create_route(clickCoordinates);
  };

  return (
    <div className="map-wrap">
      <select
        className="select-menu"
        value={fireEngine}
        onChange={handleChange}
      >
        <option value="">Select an vehicle...</option>
        {engineList.map((engine, id) => (
          <option key={"engine " + id} value={[engine[0], engine[1]]}>
            {engine[1]}
          </option>
        ))}
      </select>

      <button className="direction-button" onClick={handleClick}>
        Direction
      </button>

      {isDetailsOpen && (
        <div className="direction-details">
          <h2>Details</h2>
          <h4>Destination Point:</h4>
          <p>{destination[1] + ","}</p>
          <p>{destination[0]}</p>
          <h4>Nearest Station:</h4>
          <p> {stationName}</p>
          <h4>Distance:</h4>
          <p> {round(pathDistance / 1000, 2)} km</p>
          <h4>Time:</h4>
          <p> {round(pathTime / 60, 2)} minutes</p>
          <h4>Remaining Distance:</h4>
          <p>approx. {round(remainingDist, 2)} meters</p>
          <h4>Vehicle:</h4>
          <p> {"name: " + fireEngine[1]}</p>
          <p> {"size: " + fireEngine[0] + " m"}</p>
          <button onClick={() => setIsDetailsOpen(false)}>Close</button>
        </div>
      )}

      <div className="geocoding">
        <GeocodingControl apiKey={API_KEY} mapController={mapController} />
      </div>

      <div ref={mapContainer} className="map" />
    </div>
  );
}
