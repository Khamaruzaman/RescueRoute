from flask import Flask, request, jsonify
from flask_cors import CORS

from routing import *
from station_db import *
from engine_db import *

app = Flask(__name__)
CORS(app)


@app.route('/route', methods=['POST'])
def receive_coordinates():
    try:
        data = request.get_json()
        orig_x, orig_y = data['start_x'], data['start_y']
        dest_x, dest_y = data['end_x'], data['end_y']
        vehicle_width = data['fireEngine']

        # Generate GeoJSON data for the route
        json_data = create_route([orig_x, orig_y], [dest_x, dest_y], vehicle_width)  # Replace with your function
        # geojson_data = data
        # Return GeoJSON data as JSON response
        return jsonify(json_data)

    except Exception as e:
        return jsonify({'error': str(e)}), 400


@app.route('/station_db', methods=['GET'])
def get_station_data():
    return jsonify(read_station_db())


@app.route('/engine_db', methods=['GET'])
def get_engine_data():
    return jsonify(read_engine_db())


if __name__ == '__main__':
    app.run(debug=True)
