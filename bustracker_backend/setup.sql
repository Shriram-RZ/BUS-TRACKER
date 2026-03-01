
CREATE DATABASE IF NOT EXISTS busdb
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE busdb;



CREATE TABLE IF NOT EXISTS routes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    start_location VARCHAR(255) NOT NULL COMMENT 'Origin city/stop name',
    end_location VARCHAR(255) NOT NULL COMMENT 'Destination city/stop name'
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS stops (
    id INT AUTO_INCREMENT PRIMARY KEY,
    route_id INT NOT NULL,
    stop_name VARCHAR(255) NOT NULL,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    stop_order INT NOT NULL COMMENT '1-based ordering along the route',
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS buses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_number VARCHAR(50) NOT NULL UNIQUE COMMENT 'e.g. 21A',
    route_id INT NOT NULL,
    average_speed_kmph FLOAT NOT NULL DEFAULT 40.0,
    FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS bus_locations (
    id INT AUTO_INCREMENT PRIMARY KEY,
    bus_id INT NOT NULL UNIQUE,
    latitude FLOAT NOT NULL,
    longitude FLOAT NOT NULL,
    last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (bus_id) REFERENCES buses(id) ON DELETE CASCADE
) ENGINE=InnoDB;



INSERT INTO routes (start_location, end_location)
VALUES ('Pollachi', 'Coimbatore');

INSERT INTO stops (route_id, stop_name, latitude, longitude, stop_order) VALUES
    (1, 'Pollachi Bus Stand',    10.6590, 77.0080, 1),
    (1, 'Kinathukadavu',         10.7200, 76.9850, 2),
    (1, 'Podanur Junction',      10.9500, 76.9600, 3),
    (1, 'Gandhipuram (CBE)',     11.0168, 76.9558, 4),
    (1, 'Coimbatore Bus Stand',  11.0010, 76.9620, 5);

INSERT INTO buses (bus_number, route_id, average_speed_kmph)
VALUES ('21A', 1, 40.0);


INSERT INTO bus_locations (bus_id, latitude, longitude)
VALUES (1, 10.6590, 77.0080);

SELECT '✅ Database setup complete!' AS status;
