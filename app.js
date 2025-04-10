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

// Configurar el motor de plantillas EJS
app.set("view engine", "ejs");

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

// --- Rutas de Administración ---
app.get("/admin_login", (req, res) => {
  // Si ya está logueado, quizás redirigir a /db_admin
  if (req.session.isAdmin) {
    return res.redirect("/db_admin");
  }
  res.render("admin_login", { error: null }); // Pasar error como null inicialmente
});

const requireAuth = (req, res, next) => {
  if (req.session && req.session.isAdmin) {
    return next(); // Usuario autenticado, continuar
  } else {
    return res.redirect("/admin_login"); // No autenticado, redirigir a login
  }
};

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

// --- Middleware para Manejo de Errores Generales (al final) ---
app.use((err, req, res, next) => {
  console.error("Error no manejado:", err.stack);
  res
    .status(500)
    .render("error", { message: "Ha ocurrido un error inesperado." }); // Asume 'error.ejs'
});

// --- Iniciar el servidor ---
app.listen(port, "0.0.0.0", () => {
  // Escucha en 0.0.0.0 para aceptar conexiones externas
  console.log(
    `Servidor en ejecución en http://localhost:${port} (escuchando en todas las interfaces)`
  );
});
