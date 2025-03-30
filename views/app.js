const express = require("express");
const sqlite3 = require("sqlite3");
const ejs = require("ejs");

const app = express();
const port = process.env.PORT || 3000;

// Serve static files from the "views" directory
app.use(express.static("views"));

// Path completo de la base de datos movies.db
// Por ejemplo 'C:\\Users\\datagrip\\movies.db'
const db = new sqlite3.Database("movies.db", (err) => {
  if (err) {
    console.error("Error al conectar a la base de datos:", err.message);
    return;
  }
  console.log("Conectado a la base de datos.");

  // Activar las foreign keys y delete on cascade
  db.run("PRAGMA foreign_keys = ON", (err) => {
    if (err) {
      console.error("Error al activar las Foreign Keys:", err.message);
    } else {
      console.log("Foreign Keys activadas.");
    }
  });
});

// Configurar el motor de plantillas EJS
app.set("view engine", "ejs");

// Ruta para la página de inicio
app.get("/", (req, res) => {
  res.render("index");
});

app.get("/buscar", (req, res) => {
  const searchTerm = req.query.q;

  if (searchTerm.trim() === "") {
    return res.render("index"); // Redirige o renderiza la página principal sin hacer nada
  }

  const queryMovies = `SELECT movie_id, title FROM movie WHERE title LIKE ?`;
  const queryActors = `
  SELECT distinct person.person_id, person.person_name
  FROM person
  JOIN movie_cast ON person.person_id = movie_cast.person_id
  WHERE person.person_name LIKE ?
  GROUP BY person.person_id, person.person_name
  ORDER BY person.person_name ASC`;
  const searchValue = [`%${searchTerm}%`];

  db.all(queryMovies, searchValue, (err, movies) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error en la búsqueda de películas.");
      return;
    }

    db.all(queryActors, searchValue, (err, actors) => {
      if (err) {
        console.error(err);
        res.status(500).send("Error en la búsqueda de actores.");
        return;
      }
      res.render("resultado", {
        searchTerm: searchTerm,
        movies: movies,
        actors: actors,
      });
    });
  });
});

// Ruta para la página de datos de una película particular
app.get("/pelicula/:id", (req, res) => {
  const movieId = req.params.id;

  // Consulta SQL para obtener los datos de la película, elenco y crew
  const query = `
    SELECT
      movie.*,
      actor.person_name as actor_name,
      actor.person_id as actor_id,
      crew_member.person_name as crew_member_name,
      crew_member.person_id as crew_member_id,
      movie_cast.character_name,
      movie_cast.cast_order,
      department.department_name,
      movie_crew.job
    FROM movie
    LEFT JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    LEFT JOIN person as actor ON movie_cast.person_id = actor.person_id
    LEFT JOIN movie_crew ON movie.movie_id = movie_crew.movie_id
    LEFT JOIN department ON movie_crew.department_id = department.department_id
    LEFT JOIN person as crew_member ON crew_member.person_id = movie_crew.person_id
    WHERE movie.movie_id = ?
  `;

  // Ejecutar la consulta
  db.all(query, [movieId], (err, rows) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error al cargar los datos de la película.");
    } else if (rows.length === 0) {
      res.status(404).send("Película no encontrada.");
    } else {
      // Organizar los datos en un objeto de película con elenco y crew
      const movieData = {
        id: rows[0].id,
        title: rows[0].title,
        release_date: rows[0].release_date,
        overview: rows[0].overview,
        directors: [],
        writers: [],
        cast: [],
        crew: [],
      };

      // Crear un objeto para almacenar directores
      rows.forEach((row) => {
        if (
          row.crew_member_id &&
          row.crew_member_name &&
          row.department_name &&
          row.job
        ) {
          // Verificar si ya existe una entrada con los mismos valores en directors
          const isDuplicate = movieData.directors.some(
            (crew_member) => crew_member.crew_member_id === row.crew_member_id
          );

          if (!isDuplicate) {
            // Si no existe, agregar los datos a la lista de directors
            if (row.department_name === "Directing" && row.job === "Director") {
              movieData.directors.push({
                crew_member_id: row.crew_member_id,
                crew_member_name: row.crew_member_name,
                department_name: row.department_name,
                job: row.job,
              });
            }
          }
        }
      });

      // Crear un objeto para almacenar writers
      rows.forEach((row) => {
        if (
          row.crew_member_id &&
          row.crew_member_name &&
          row.department_name &&
          row.job
        ) {
          // Verificar si ya existe una entrada con los mismos valores en writers
          const isDuplicate = movieData.writers.some(
            (crew_member) => crew_member.crew_member_id === row.crew_member_id
          );

          if (!isDuplicate) {
            // Si no existe, agregar los datos a la lista de writers
            if (row.department_name === "Writing" && row.job === "Writer") {
              movieData.writers.push({
                crew_member_id: row.crew_member_id,
                crew_member_name: row.crew_member_name,
                department_name: row.department_name,
                job: row.job,
              });
            }
          }
        }
      });

      // Crear un objeto para almacenar el elenco
      rows.forEach((row) => {
        if (row.actor_id && row.actor_name && row.character_name) {
          // Verificar si ya existe una entrada con los mismos valores en el elenco
          const isDuplicate = movieData.cast.some(
            (actor) => actor.actor_id === row.actor_id
          );

          if (!isDuplicate) {
            // Si no existe, agregar los datos a la lista de elenco
            movieData.cast.push({
              actor_id: row.actor_id,
              actor_name: row.actor_name,
              character_name: row.character_name,
              cast_order: row.cast_order,
            });
          }
        }
      });

      // Crear un objeto para almacenar el crew
      rows.forEach((row) => {
        if (
          row.crew_member_id &&
          row.crew_member_name &&
          row.department_name &&
          row.job
        ) {
          // Verificar si ya existe una entrada con los mismos valores en el crew
          const isDuplicate = movieData.crew.some(
            (crew_member) => crew_member.crew_member_id === row.crew_member_id
          );

          // console.log('movieData.crew: ', movieData.crew)
          // console.log(isDuplicate, ' - row.crew_member_id: ', row.crew_member_id)
          if (!isDuplicate) {
            // Si no existe, agregar los datos a la lista de crew
            if (
              row.department_name !== "Directing" &&
              row.job !== "Director" &&
              row.department_name !== "Writing" &&
              row.job !== "Writer"
            ) {
              movieData.crew.push({
                crew_member_id: row.crew_member_id,
                crew_member_name: row.crew_member_name,
                department_name: row.department_name,
                job: row.job,
              });
            }
          }
        }
      });

      res.render("pelicula", { movie: movieData });
    }
  });
});

// Ruta para mostrar la página de un actor específico
app.get("/actor/:id", (req, res) => {
  const actorId = req.params.id;

  // Consulta SQL para obtener las películas en las que participó el actor
  const query = `
    SELECT DISTINCT
      person.person_name as actorName,
      movie.*
    FROM movie
    INNER JOIN movie_cast ON movie.movie_id = movie_cast.movie_id
    INNER JOIN person ON person.person_id = movie_cast.person_id
    WHERE movie_cast.person_id = ?;
  `;

  // Ejecutar la consulta
  db.all(query, [actorId], (err, movies) => {
    if (err) {
      console.error(err);
      res.status(500).send("Error al cargar las películas del actor.");
    } else {
      // Obtener el nombre del actor
      const actorName = movies.length > 0 ? movies[0].actorName : "";

      res.render("actor", { actorName, movies });
    }
  });
});

// Iniciar el servidor
app.listen(port, () => {
  console.log(`Servidor en ejecución en http://localhost:${port}`);
});
