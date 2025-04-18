const path = require("path");
const express = require("express");
const ejs = require("ejs");
require("dotenv").config(); // Asegúrate que esté al principio
const db = require("./db"); // Importa tu módulo de DB
const session = require("express-session");

const app = express();
const port = process.env.PORT || 3000; // Usa el puerto 3000 si no está definido en .env

// --- Middlewares ---
app.use(express.static("views")); // Servir archivos estáticos (CSS, JS de cliente, imágenes)
app.use(express.urlencoded({ extended: true })); // Para parsear datos de formularios
app.use(
  session({
    secret: process.env.SESSION_SECRET, // ¡IMPORTANTE: Define esto en tu .env!
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Cambiar a true si usas HTTPS configurado correctamente
  })
);

app.use(express.static(path.join(__dirname, "public")));

// Configurar el motor de plantillas EJS
app.set("view engine", "ejs");

// Middleware de autenticación
const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next(); // Usuario autenticado, continuar
  } else {
    return res.redirect("/admin_login"); // No autenticado, redirigir a login
  }
};

// --- Rutas Públicas ---

// Ruta para la página de inicio (simple)
app.get("/", (req, res) => {
  // Podrías pasar datos aquí si quisieras un dashboard, ej: counts
  res.render("index", { title: "Sistema de Aulas" }); // Pasa un título a la plantilla
});

// Ruta de búsqueda (Profesores Y Materias)
app.get("/buscar", async (req, res) => {
  // Mantenemos async
  const searchTerm = req.query.q;

  // Validar término de búsqueda
  if (!searchTerm || searchTerm.trim() === "") {
    // Renderizar una plantilla de resultados vacía o con un mensaje
    // Es mejor usar una plantilla dedicada para resultados que 'buscar_form'
    return res.render("resultado", {
      // <--- Nueva plantilla sugerida
      searchTerm: "",
      profesores: [], // Pasar arrays vacíos
      materias: [],
      error: "Por favor, ingresa un término de búsqueda.",
    });
  }

  // Consulta para buscar Profesores
  const queryProfesores = `
    SELECT profesor_id, nombre, email
    FROM profesores
    WHERE nombre ILIKE $1 -- Usar ILIKE para case-insensitive
    ORDER BY nombre ASC;
  `;

  // Consulta para buscar Materias
  const queryMaterias = `
    SELECT materia_id, nombre
    FROM materias
    WHERE nombre ILIKE $1 -- Usar ILIKE
    ORDER BY nombre ASC;
  `;

  // El valor para el placeholder $1 (igual para ambas consultas)
  const searchValue = [`%${searchTerm}%`];

  try {
    // Ejecutar AMBAS consultas en paralelo usando Promise.all
    const [profesores, materias] = await Promise.all([
      db.queryAll(queryProfesores, searchValue), // Ejecuta la consulta de profesores
      db.queryAll(queryMaterias, searchValue), // Ejecuta la consulta de materias
    ]);

    // Renderizar la plantilla de resultados, pasando ambos arrays
    res.render("resultado", {
      // <--- Usar la plantilla de resultados
      searchTerm: searchTerm,
      profesores: profesores, // Resultados de la búsqueda de profesores
      materias: materias, // Resultados de la búsqueda de materias
      error: null,
    });
  } catch (err) {
    // Manejo de errores si CUALQUIERA de las consultas falla
    console.error("Error en la búsqueda:", err);
    // Renderizar la plantilla de resultados mostrando un error
    res.render("resultado", {
      // <--- Usar la plantilla de resultados
      searchTerm: searchTerm,
      profesores: [], // Pasar arrays vacíos en caso de error
      materias: [],
      error: "Error al realizar la búsqueda. Inténtalo de nuevo.",
    });
    // Podrías usar res.status(500) aquí también si prefieres,
    // pero renderizar la página con un mensaje de error suele ser más amigable.
  }
});

// Ruta para ver detalles de un Profesor específico
app.get("/profesor/:id", async (req, res) => {
  const profesorId = req.params.id;

  // Consulta para obtener datos del profesor
  const queryProfesor = `
    SELECT profesor_id, nombre, email, tarjeta_id
    FROM profesores
    WHERE profesor_id = $1;
  `;
  // Consulta para obtener las materias del profesor
  const queryMaterias = `
    SELECT m.materia_id, m.nombre
    FROM materias m
    JOIN profesor_materia pm ON m.materia_id = pm.materia_id
    WHERE pm.profesor_id = $1
    ORDER BY m.nombre ASC;
  `;
  //REVISAR
  // Consulta para obtener la última ubicación conocida (opcional, puede ser más compleja)
  const queryLastLocation = `
    SELECT a.aula_id, a.nombre as aula_nombre, pa.isentry, pa.timestamp
    FROM profesor_aula pa
    JOIN aulas a ON pa.aula_id = a.aula_id
    WHERE pa.profesor_id = $1
    ORDER BY pa.timestamp DESC
    LIMIT 1;
  `;

  try {
    // Ejecutar consultas (pueden ser en paralelo)
    const [profesorResult, materiasResult, locationResult] = await Promise.all([
      db.query(queryProfesor, [profesorId]), // db.query si esperas 0 o 1 fila
      db.queryAll(queryMaterias, [profesorId]), // db.queryAll para múltiples materias
      db.query(queryLastLocation, [profesorId]), // db.query para la última ubicación
    ]);

    // Verificar si el profesor existe
    if (profesorResult.rows.length === 0) {
      return res.status(404).send("Profesor no encontrado.");
    }

    const profesorData = profesorResult.rows[0];
    profesorData.materias = materiasResult; // Ya es un array de filas {materia_id, nombre}
    profesorData.lastLocation =
      locationResult.rows.length > 0 ? locationResult.rows[0] : null;

    res.render("profesor", { profesor: profesorData });
  } catch (err) {
    console.error(`Error al cargar datos del profesor ${profesorId}:`, err);
    res.status(500).send("Error al cargar los datos del profesor.");
  }
});

// IMPLEMENTAR
// Ruta para ver detalles/estado de un Aula específica
app.get("/aula/:id", async (req, res) => {
  const aulaId = req.params.id;

  // Consulta para obtener datos del aula
  const queryAula = `SELECT aula_id, nombre, esp32_id FROM aulas WHERE aula_id = $1;`;
  // Consulta para obtener los últimos N eventos del aula
  const queryEvents = `
    SELECT pa.timestamp, pa.isentry, p.profesor_id, p.nombre as profesor_nombre
    FROM profesor_aula pa
    JOIN profesores p ON pa.profesor_id = p.profesor_id
    WHERE pa.aula_id = $1
    ORDER BY pa.timestamp DESC
    LIMIT 20; -- Muestra los últimos 20 eventos
  `;

  try {
    const [aulaResult, eventsResult] = await Promise.all([
      db.query(queryAula, [aulaId]),
      db.queryAll(queryEvents, [aulaId]),
    ]);

    if (aulaResult.rows.length === 0) {
      return res.status(404).send("Aula no encontrada.");
    }

    const aulaData = aulaResult.rows[0];
    aulaData.events = eventsResult; // Array de {timestamp, isentry, profesor_id, profesor_nombre}

    // Lógica adicional: Determinar quién está *actualmente* dentro (más complejo)
    // Podrías procesar aulaData.events aquí para encontrar el último estado de cada profesor en esta aula
    let profesoresDentro = new Map();
    aulaData.events.forEach((event) => {
      if (!profesoresDentro.has(event.profesor_id)) {
        // Solo nos importa el evento más reciente por profesor
        profesoresDentro.set(event.profesor_id, {
          nombre: event.profesor_nombre,
          isentry: event.isentry,
          timestamp: event.timestamp,
        });
      }
    });
    // Filtrar solo los que están dentro
    aulaData.profesoresActuales = Array.from(profesoresDentro.values()).filter(
      (p) => p.isentry
    );

    res.render("aula_detalle", { aula: aulaData }); // Necesitas crear 'aula_detalle.ejs'
  } catch (err) {
    console.error(`Error al cargar datos del aula ${aulaId}:`, err);
    res.status(500).send("Error al cargar los datos del aula.");
  }
});

// --- Rutas de Administración de Profesores ---
// Ruta para crear un profesor (POST)
app.post(
  "/admin/profesores/crear",
  requireAuth,
  express.json(),
  async (req, res) => {
    const { nombre, email, tarjeta_id } = req.body;

    // Validación básica
    if (!nombre || !tarjeta_id) {
      return res.status(400).json({
        success: false,
        message: "El nombre y el ID de tarjeta son obligatorios",
      });
    }

    try {
      // Verificar si ya existe un profesor con esa tarjeta_id
      const existingProf = await db.query(
        "SELECT profesor_id FROM profesores WHERE tarjeta_id = $1",
        [tarjeta_id]
      );

      if (existingProf.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Ya existe un profesor con ese ID de tarjeta",
        });
      }

      // Insertar el nuevo profesor
      const result = await db.query(
        "INSERT INTO profesores (nombre, email, tarjeta_id) VALUES ($1, $2, $3) RETURNING profesor_id",
        [nombre, email, tarjeta_id]
      );

      res.status(201).json({
        success: true,
        message: "Profesor creado correctamente",
        profesor_id: result.rows[0].profesor_id,
      });
    } catch (err) {
      console.error("Error al crear profesor:", err);
      res.status(500).json({
        success: false,
        message: "Error al crear el profesor en la base de datos",
        error: err.message,
      });
    }
  }
);

// Ruta para eliminar un profesor (DELETE)
app.delete(
  "/admin/profesores/eliminar/:tarjetaId",
  requireAuth,
  async (req, res) => {
    const { tarjetaId } = req.params;

    try {
      // Verificar si existe el profesor
      const profesor = await db.query(
        "SELECT profesor_id FROM profesores WHERE tarjeta_id = $1",
        [tarjetaId]
      );

      if (profesor.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Profesor no encontrado",
        });
      }

      // Eliminar el profesor
      await db.query("DELETE FROM profesores WHERE tarjeta_id = $1", [
        tarjetaId,
      ]);

      res.json({
        success: true,
        message: "Profesor eliminado correctamente",
      });
    } catch (err) {
      console.error("Error al eliminar profesor:", err);
      res.status(500).json({
        success: false,
        message: "Error al eliminar el profesor de la base de datos",
        error: err.message,
      });
    }
  }
);

// Ruta para mostrar el formulario de edición de profesor
app.get("/admin/profesores/editar/:id", requireAuth, async (req, res) => {
  const profesorId = req.params.id;

  try {
    // Obtener datos del profesor
    const result = await db.query(
      "SELECT profesor_id, nombre, email, tarjeta_id FROM profesores WHERE profesor_id = $1",
      [profesorId]
    );

    if (result.rows.length === 0) {
      return res.status(404).render("error", {
        message: "Profesor no encontrado",
        error: { status: 404 },
      });
    }

    const profesor = result.rows[0];

    // También obtenemos las materias para potencialmente asignarlas
    const materias = await db.queryAll(
      "SELECT materia_id, nombre FROM materias ORDER BY nombre ASC"
    );

    // Obtener las materias asignadas actualmente al profesor
    const materiasProfesor = await db.queryAll(
      `SELECT materia_id FROM profesor_materia WHERE profesor_id = $1`,
      [profesorId]
    );

    // Crear un array con los IDs de las materias asignadas
    const materiasAsignadas = materiasProfesor.map((m) => m.materia_id);

    res.render("profesor_editar", {
      profesor: profesor,
      materias: materias,
      materiasAsignadas: materiasAsignadas,
      error: null,
    });
  } catch (err) {
    console.error("Error al cargar datos del profesor para editar:", err);
    res.status(500).render("error", {
      message: "Error al cargar datos del profesor",
      error: { status: 500, stack: err.stack },
    });
  }
});

// Ruta para procesar la actualización de un profesor
app.post("/admin/profesores/actualizar/:id", requireAuth, async (req, res) => {
  const profesorId = req.params.id;
  const { nombre, email, tarjeta_id, materias } = req.body;

  // Validación básica
  if (!nombre || !tarjeta_id) {
    return res.status(400).render("profesor_editar", {
      profesor: { profesor_id: profesorId, nombre, email, tarjeta_id },
      materias: [],
      materiasAsignadas: materias || [],
      error: "El nombre y el ID de tarjeta son obligatorios",
    });
  }

  try {
    // Verificar si el tarjeta_id ya está en uso por otro profesor
    const existingProf = await db.query(
      "SELECT profesor_id FROM profesores WHERE tarjeta_id = $1 AND profesor_id != $2",
      [tarjeta_id, profesorId]
    );

    if (existingProf.rows.length > 0) {
      // Volver a cargar todos los datos necesarios para el formulario
      const allMaterias = await db.queryAll(
        "SELECT materia_id, nombre FROM materias ORDER BY nombre ASC"
      );

      return res.status(400).render("profesor_editar", {
        profesor: { profesor_id: profesorId, nombre, email, tarjeta_id },
        materias: allMaterias,
        materiasAsignadas: materias || [],
        error: "Ya existe otro profesor con ese ID de tarjeta",
      });
    }

    // Actualizar los datos del profesor
    await db.query(
      "UPDATE profesores SET nombre = $1, email = $2, tarjeta_id = $3 WHERE profesor_id = $4",
      [nombre, email, tarjeta_id, profesorId]
    );

    // Gestionar la asignación de materias si se proporcionan
    if (materias && Array.isArray(materias)) {
      // Eliminar todas las asignaciones actuales
      await db.query("DELETE FROM profesor_materia WHERE profesor_id = $1", [
        profesorId,
      ]);

      // Insertar las nuevas asignaciones
      for (const materiaId of materias) {
        await db.query(
          "INSERT INTO profesor_materia (profesor_id, materia_id) VALUES ($1, $2)",
          [profesorId, materiaId]
        );
      }
    }

    // Redirigir al panel de administración
    req.session.message = "Profesor actualizado correctamente";
    res.redirect("/db_admin");
  } catch (err) {
    console.error("Error al actualizar profesor:", err);
    res.status(500).render("error", {
      message: "Error al actualizar el profesor en la base de datos",
      error: { status: 500, stack: err.stack },
    });
  }
});

// --- Rutas de Administración ---
app.get("/admin_login", (req, res) => {
  // Si ya está logueado, quizás redirigir a /db_admin
  if (req.session.isAdmin) {
    return res.redirect("/db_admin");
  }
  res.render("admin_login", { error: null }); // Pasar error como null inicialmente
});

app.post("/admin_login", (req, res) => {
  const { username, password } = req.body;
  if (
    username === process.env.ADMIN_USERNAME &&
    password === process.env.ADMIN_PASSWORD
  ) {
    req.session.isAdmin = true;
    res.redirect("/db_admin");
  } else {
    res.render("admin_login", { error: "Usuario o contraseña incorrectos" });
  }
});

app.post("/admin/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error("Error al destruir la sesión:", err);
    }
    res.redirect("/admin_login");
  });
});

// Panel de Administración Principal (Protegido)
app.get("/db_admin", requireAuth, async (req, res) => {
  try {
    // Obtener listas de todas las entidades principales
    const [profesores, aulas, materias] = await Promise.all([
      db.queryAll(
        "SELECT profesor_id, nombre, email, tarjeta_id FROM profesores ORDER BY nombre ASC"
      ),
      db.queryAll(
        "SELECT aula_id, nombre, esp32_id FROM aulas ORDER BY nombre ASC"
      ),
      db.queryAll(
        "SELECT materia_id, nombre FROM materias ORDER BY nombre ASC"
      ),
    ]);

    res.render("db_admin", {
      profesores: profesores,
      aulas: aulas,
      materias: materias,
      error: null,
    });
  } catch (err) {
    console.error("Error al cargar datos para el panel de admin:", err);
    res.render("db_admin", {
      // Renderizar igual pero mostrando un error
      profesores: [],
      aulas: [],
      materias: [],
      error: "No se pudieron cargar los datos.",
    });
  }
});

// --- Ruta de Prueba DB (Sin cambios, sigue útil) ---
app.get("/test-db", (req, res) => {
  db.query("SELECT NOW() as now", [], (err, result) => {
    if (err) {
      console.error("Error al ejecutar consulta de prueba:", err);
      return res.status(500).json({
        success: false,
        message: "Error en la consulta a la base de datos",
        error: err.message,
        code: err.code,
      });
    }
    if (!result || !result.rows || result.rows.length === 0) {
      return res.status(500).json({
        success: false,
        message: "La consulta no devolvió resultados.",
      });
    }
    return res.status(200).json({
      success: true,
      message: "Conexión y consulta a la base de datos exitosa",
      timestamp: result.rows[0].now,
    });
  });
});

// IMPLEMENTAR LAS PLANTILLAS
// --- Middleware para Manejo de Errores 404 (al final) ---
app.use((req, res, next) => {
  res.status(404).render("404"); // Asume que tienes una plantilla '404.ejs'
});

// --- Middleware para Manejo de Errores Generales (AL FINAL DE TODO) ---
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err.stack); // Loguea el error completo
  // Establece locals, solo proporciona error en desarrollo
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV === "development" ? err : {}; // No filtrar error en dev

  // Renderiza la página de error
  res.status(err.status || 500);
  res.render("error"); // Renderiza views/error.ejs
});

// --- Iniciar el servidor ---
app.listen(port, "0.0.0.0", () => {
  // Escucha en 0.0.0.0 para aceptar conexiones externas
  console.log(
    `Servidor en ejecución en http://localhost:${port} (escuchando en todas las interfaces)`
  );
});
