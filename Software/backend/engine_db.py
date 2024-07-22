import mysql.connector


def read_engine_db():
    mydb = mysql.connector.connect(
        host="localhost",
        user="root",
        password="root",
        database="fire_station"
    )

    mycursor = mydb.cursor()

    mycursor.execute(
        "SELECT vehicle_id, name, width FROM engines;")

    engines = []
    for x in mycursor:
        engines.append([x[2], x[1]])
    return engines


if __name__ == "__main__":
    read_engine_db()
