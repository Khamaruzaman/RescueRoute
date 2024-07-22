import osmnx as ox
from pyrosm import OSM, get_data
import pandas as pd
import networkx as nx
import pandas_geojson as pdg
from numpy import nan


def road_class_to_kmph(road_class):
    if road_class == "motorway":
        return 90
    elif road_class == "motorway_link":
        return 70
    elif road_class in ["trunk", "trunk_link"]:
        return 60
    elif road_class == "service":
        return 30
    elif road_class == "living_street":
        return 20
    else:
        return 50


def extract_lon_lat(row):
    geometry = row['geometry']
    if geometry is None:  # Handle missing geometry values gracefully
        return None, None
    return float(str(geometry.x)), float(str(geometry.y))


def id_to_lnglat(gdf, id_list):
    coordinate_list = []

    for id in id_list:
        filtered_df = gdf[gdf['id'] == id]

        if len(filtered_df) == 0:
            print("no matching node id")
        else:
            latitude = filtered_df['latitude'].iloc[0]
            longitude = filtered_df['longitude'].iloc[0]

            coordinate_list.append([longitude, latitude])

    return coordinate_list


def fill_maxspeed(edges):
    # Separate rows with / without speed limit information
    mask = edges["maxspeed"].isnull()
    edges_without_maxspeed = edges.loc[mask].copy()
    edges_with_maxspeed = edges.loc[~mask].copy()

    # Apply the function and update the maxspeed
    edges_without_maxspeed["maxspeed"] = edges_without_maxspeed["highway"].apply(road_class_to_kmph)
    edges = pd.concat([edges_without_maxspeed, edges_with_maxspeed], ignore_index=True)

    return edges


def road_class_to_width(road_class):
    road_width_map = {
        "motorway": 5.0,
        "primary": 4.5,
        "secondary": 3.8,
        "tertiary": 3.2,
        "residential": 2.8,
        "living_street": 2.3,
        "unclassified": 2.5,
        "tertiary_link": 3.0,
        "service": 2.5,
        "secondary_link": 3.2,
        "primary_link": 4.0,
        "services": 2.7,
        "trunk": 4.8,
        'cycleway': 1.5,
        'footway': 1.0,
        'pedestrian': 1.5,
        'trail': 1.0,
        'crossing': 2.0,
    }

    # Handle cases not explicitly defined in the map
    return road_width_map.get(road_class, 1.2)  # Default to 8m for unknown classes


def fill_width(edges):
    if "width" not in edges.columns:
        edges["width"] = nan
    mask = edges["width"].isnull()
    edges_without_width = edges.loc[mask].copy()
    edges_with_width = edges.loc[~mask].copy()
    edges_without_width["width"] = edges_without_width["highway"].apply(road_class_to_width)
    edges = pd.concat([edges_without_width, edges_with_width], ignore_index=True)

    return edges


def filter_gdf(gdf, attribute, filter_threshold):
    gdf[attribute] = pd.to_numeric(gdf[attribute], errors='coerce')
    gdf = gdf[(gdf[attribute] + 0.5) > filter_threshold]

    return gdf


def create_geojson(coordinate_list, filename):
    geojson = pdg.GeoJSON()
    path = pdg.core.LineString(geometry=coordinate_list)
    geojson.add_features([path])
    pdg.save_geojson(geojson, f'{filename}.geojson', indent=4)


def create_route(start, end, vehicle_width):
    # osm=OSM(get_data("kerala"))
    osm = OSM("data/kattakada_01.pbf")

    nodes, edges = osm.get_network(network_type="all", nodes=True)
    edges["maxspeed"] = edges["maxspeed"].astype(float).astype(pd.Int64Dtype())

    nodes[['longitude', 'latitude']] = nodes.apply(extract_lon_lat, axis=1, result_type='expand')

    edges = fill_width(edges)

    edges = filter_gdf(gdf=edges, attribute="width", filter_threshold=vehicle_width)
    edges = fill_maxspeed(edges)

    edges["travel_time_seconds"] = edges["length"] / (edges["maxspeed"] / 3.6)
    # print(edges)

    G = osm.to_graph(nodes, edges, graph_type="networkx")

    orig_x, orig_y = start[0], start[1]
    dest_x, dest_y = end[0], end[1]

    orig_node_id, dist_to_orig = ox.distance.nearest_nodes(G, X=orig_x, Y=orig_y, return_dist=True)
    dest_node_id, dist_to_dest = ox.distance.nearest_nodes(G, X=dest_x, Y=dest_y, return_dist=True)

    # Get also the actual travel times (summarize)
    travel_length = nx.dijkstra_path_length(G, source=orig_node_id, target=dest_node_id, weight='length')
    travel_time = nx.dijkstra_path_length(G, source=orig_node_id, target=dest_node_id, weight='travel_time_seconds')
    travel_time = travel_time * 1.3

    # Calculate the paths by walking and cycling
    shortest_path_nodes = nx.dijkstra_path(G, source=orig_node_id, target=dest_node_id, weight='length')
    fastest_path_nodes = nx.dijkstra_path(G, source=orig_node_id, target=dest_node_id, weight='travel_time_seconds')

    shortest_path_coordinates = id_to_lnglat(gdf=nodes, id_list=shortest_path_nodes)

    fastest_path_coordinates = id_to_lnglat(gdf=nodes, id_list=fastest_path_nodes)

    geojson = pdg.GeoJSON()
    path = pdg.core.LineString(geometry=fastest_path_coordinates)
    geojson.add_features([path])

    data = {"geojson": geojson,
            "distance": travel_length,
            "time": travel_time,
            }

    return data
