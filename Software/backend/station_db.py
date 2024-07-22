import mysql.connector


def read_station_db():
    mydb = mysql.connector.connect(
        host="localhost",
        user="root",
        password="root",
        database="fire_station"
    )

    mycursor = mydb.cursor()

    mycursor.execute(
        "SELECT station_id, name, ST_X(coordinates) AS longitude, ST_Y(coordinates) AS latitude FROM stations;")

    stations = []
    for x in mycursor:
        stations.append([[x[3], x[2]], x[1]])

    return stations


if __name__ == "__main__":
    read_station_db()
