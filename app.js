const path = require("path");
const express = require("express");
const ejs = require("ejs");
require("dotenv").config(); // Asegúrate que esté al principio
const db = require("./db"); // Importa tu módulo de DB
const session = require("express-session");
const mqtt = require("mqtt");
const bodyParser = require("body-parser");

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

app.use(bodyParser.urlencoded({ extended: true }));

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

// MQTT connection
const mqttClient = mqtt.connect("mqtt://54.80.230.215:1883", {
  username: "mqttUser",
  password: "mqttPass",
  clientId: "NodeJSPublisher",
});

mqttClient.on("connect", () => {
  console.log("Conectado a broker MQTT");
});

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
      SELECT p.profesor_id, p.nombre, p.email,
       (i.evento = 'entrada') AS isentry
      FROM profesores p
      LEFT JOIN LATERAL (
        SELECT evento
        FROM ingresos
        WHERE profesor_id = p.profesor_id
        ORDER BY fecha DESC
        LIMIT 1
      ) i ON true
      WHERE p.nombre ILIKE $1
      ORDER BY p.nombre ASC;
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
  const profesorId = parseInt(req.params.id, 10);

  /* 1. Datos básicos del profesor */
  const queryProfesor = `
    SELECT profesor_id, nombre, email, tarjeta_id
      FROM profesores
     WHERE profesor_id = $1;
  `;

  /* 2. Materias del profesor */
  const queryMaterias = `
    SELECT m.materia_id, m.nombre
      FROM materias m
      JOIN profesor_materia pm ON m.materia_id = pm.materia_id
     WHERE pm.profesor_id = $1
  ORDER BY m.nombre;
  `;

  /* 3. Última ubicación registrada -------------- */
  const queryLastLocation = `
    SELECT a.aula_id,
       a.nombre AS aula_nombre,
       a.esp32_id,
       (i.evento = 'entrada') AS isentry,
       i.fecha AS timestamp
    FROM ingresos i
    JOIN aulas a USING (aula_id)
    WHERE i.profesor_id = $1
    ORDER BY i.fecha DESC
    LIMIT 1;
  `;

  try {
    /* ejecutamos las tres consultas en paralelo */
    const [profRes, matRes, locRes] = await Promise.all([
      db.query(queryProfesor, [profesorId]), // 0-1 filas
      db.queryAll(queryMaterias, [profesorId]), // varias filas
      db.query(queryLastLocation, [profesorId]), // 0-1 filas
    ]);

    if (profRes.rows.length === 0) {
      return res.status(404).send("Profesor no encontrado");
    }

    const profesor = profRes.rows[0];
    profesor.materias = matRes; // array [{materia_id,nombre}]
    profesor.lastLocation = locRes.rows[0] || null; // o null si no hay ingresos

    const enviado = req.query.enviado === "1";
    res.render("profesor", { profesor, enviado });
  } catch (err) {
    console.error("Error al cargar datos del profesor:", err);
    res.status(500).send("Error al cargar los datos del profesor.");
  }
});

// Ruta para procesar envío de formulario
app.post("/profesor/:id/preguntar", (req, res) => {
  const { alumno, subject, esp32Id } = req.body;
  const mensaje = `${alumno}`;
  const topic = `esp32/${esp32Id}/display`;

  mqttClient.publish(topic, mensaje, { qos: 0 }, (err) => {
    if (err) console.error("Error publicando a MQTT:", err);
    else console.log(`Publicado en ${topic}: ${mensaje}`);
  });

  res.redirect(`/profesor/${req.params.id}?enviado=1`);
});

// Ruta para ver detalles de una Materia específica
app.get("/materia/:id", async (req, res) => {
  const materiaId = parseInt(req.params.id, 10);

  const queryMateria = `
    SELECT materia_id, nombre
    FROM materias
    WHERE materia_id = $1;
  `;

  const queryProfesores = `
  SELECT p.profesor_id, p.nombre,
    (SELECT i.evento = 'entrada'
     FROM ingresos i
     WHERE i.profesor_id = p.profesor_id
     ORDER BY i.fecha DESC
     LIMIT 1) AS isentry
  FROM profesores p
  JOIN profesor_materia pm ON p.profesor_id = pm.profesor_id
  WHERE pm.materia_id = $1
  ORDER BY p.nombre;
`;

  try {
    const [materiaRes, profsRes] = await Promise.all([
      db.query(queryMateria, [materiaId]),
      db.queryAll(queryProfesores, [materiaId]),
    ]);

    if (materiaRes.rows.length === 0) {
      return res.status(404).render("error", {
        message: "Materia no encontrada",
        error: { status: 404 },
      });
    }

    const materia = materiaRes.rows[0];
    materia.profesores = profsRes;

    res.render("materia", { materia });
  } catch (err) {
    console.error("Error al cargar datos de la materia:", err);
    res.status(500).render("error", {
      message: "Error al cargar los datos de la materia",
      error: { status: 500, stack: err.stack },
    });
  }
});

// --- Rutas de Administración de Profesores ---
// Ruta para crear un profesor (POST)
app.post(
  "/admin/profesores/crear",
  requireAuth,
  express.json(),
  async (req, res) => {
    let { nombre, email, tarjeta_id } = req.body;

    // Validación básica
    if (!nombre || !tarjeta_id) {
      return res.status(400).json({
        success: false,
        message: "El nombre y el ID de tarjeta son obligatorios",
      });
    }

    tarjeta_id = String(tarjeta_id).toUpperCase().trim();

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
  const { nombre, email, tarjeta_id } = req.body;

  try {
    // Obtener los datos actuales del profesor
    const currentData = await db.query(
      "SELECT nombre, email, tarjeta_id FROM profesores WHERE profesor_id = $1",
      [profesorId]
    );

    if (currentData.rows.length === 0) {
      return res.status(404).render("error", {
        message: "Profesor no encontrado",
        error: { status: 404 },
      });
    }

    const current = currentData.rows[0];

    // Usar valores actuales si los nuevos están vacíos - NADA ES OBLIGATORIO
    const updatedNombre = nombre && nombre.trim() ? nombre.trim() : current.nombre;
    const updatedEmail = email !== undefined ? (email.trim() || null) : current.email;
    const updatedTarjetaId = tarjeta_id && tarjeta_id.trim() ? tarjeta_id.trim().toUpperCase() : current.tarjeta_id;

    // Verificar si el tarjeta_id ya está en uso por otro profesor (solo si cambió)
    if (updatedTarjetaId && updatedTarjetaId !== current.tarjeta_id) {
      const existingProf = await db.query(
        "SELECT profesor_id FROM profesores WHERE tarjeta_id = $1 AND profesor_id != $2",
        [updatedTarjetaId, profesorId]
      );

      if (existingProf.rows.length > 0) {
        return res.status(400).render("profesor_editar", {
          profesor: { 
            profesor_id: profesorId, 
            nombre: nombre, 
            email: email, 
            tarjeta_id: tarjeta_id 
          },
          error: "Ya existe otro profesor con ese ID de tarjeta",
        });
      }
    }

    // Actualizar los datos del profesor
    await db.query(
      "UPDATE profesores SET nombre = $1, email = $2, tarjeta_id = $3 WHERE profesor_id = $4",
      [updatedNombre, updatedEmail, updatedTarjetaId, profesorId]
    );

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

// --- Rutas de Administración de Aulas ---
// Ruta para crear un aula (POST)
app.post("/admin/aula/crear", requireAuth, express.json(), async (req, res) => {
  let { nombre, esp32_id } = req.body;

  // Validación básica
  if (!nombre || !esp32_id) {
    return res.status(400).json({
      success: false,
      message: "El nombre y el ID del ESP32 son obligatorios",
    });
  }

  esp32_id = String(esp32_id).toUpperCase().trim();

  try {
    // Verificar si ya existe un aula con ese ESP32 ID
    const existingAula = await db.query(
      "SELECT aula_id FROM aulas WHERE esp32_id = $1",
      [esp32_id]
    );

    if (existingAula.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: "Ya existe un aula con ese ID de ESP32",
      });
    }

    // Insertar la nueva aula
    const result = await db.query(
      "INSERT INTO aulas (nombre, esp32_id) VALUES ($1, $2) RETURNING aula_id",
      [nombre, esp32_id]
    );

    res.status(201).json({
      success: true,
      message: "Aula creada correctamente",
      aula_id: result.rows[0].aula_id,
    });
  } catch (err) {
    console.error("Error al crear aula:", err);
    res.status(500).json({
      success: false,
      message: "Error al crear el aula en la base de datos",
      error: err.message,
    });
  }
});

// Ruta para eliminar un aula (DELETE)
app.delete("/admin/aula/eliminar/:esp32Id", requireAuth, async (req, res) => {
  const { esp32Id } = req.params;

  try {
    // Verificar si existe el aula
    const aula = await db.query(
      "SELECT aula_id FROM aulas WHERE esp32_id = $1",
      [esp32Id]
    );

    if (aula.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Aula no encontrada",
      });
    }

    // Eliminar el aula
    await db.query("DELETE FROM aulas WHERE esp32_id = $1", [esp32Id]);

    res.json({
      success: true,
      message: "Aula eliminada correctamente",
    });
  } catch (err) {
    console.error("Error al eliminar aula:", err);
    res.status(500).json({
      success: false,
      message: "Error al eliminar el aula de la base de datos",
      error: err.message,
    });
  }
});

// Ruta para mostrar el formulario de edición de aula
app.get("/admin/aula/editar/:id", requireAuth, async (req, res) => {
  const aulaId = req.params.id;

  try {
    // Obtener datos del aula
    const result = await db.query(
      "SELECT aula_id, nombre, esp32_id FROM aulas WHERE aula_id = $1",
      [aulaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).render("error", {
        message: "Aula no encontrada",
        error: { status: 404 },
      });
    }

    const aula = result.rows[0];

    res.render("aulas_editar", {
      aula: aula,
      error: null,
    });
  } catch (err) {
    console.error("Error al cargar datos del aula para editar:", err);
    res.status(500).render("error", {
      message: "Error al cargar datos del aula",
      error: { status: 500, stack: err.stack },
    });
  }
});

// Ruta para procesar la actualización de un aula
app.post("/admin/aula/actualizar/:id", requireAuth, async (req, res) => {
  const aulaId = req.params.id;
  const { nombre, esp32_id } = req.body;

  // Validación básica
  if (!nombre || !esp32_id) {
    return res.status(400).render("aulas_editar", {
      aula: { aula_id: aulaId, nombre, esp32_id },
      error: "El nombre y el ID del ESP32 son obligatorios",
    });
  }

  try {
    // Verificar si el esp32_id ya está en uso por otra aula
    const existingAula = await db.query(
      "SELECT aula_id FROM aulas WHERE esp32_id = $1 AND aula_id != $2",
      [esp32_id, aulaId]
    );

    if (existingAula.rows.length > 0) {
      return res.status(400).render("aulas_editar", {
        aula: { aula_id: aulaId, nombre, esp32_id },
        error: "Ya existe otra aula con ese ID de ESP32",
      });
    }

    // Actualizar los datos del aula
    await db.query(
      "UPDATE aulas SET nombre = $1, esp32_id = $2 WHERE aula_id = $3",
      [nombre, esp32_id, aulaId]
    );

    // Redirigir al panel de administración
    req.session.message = "Aula actualizada correctamente";
    res.redirect("/db_admin");
  } catch (err) {
    console.error("Error al actualizar aula:", err);
    res.status(500).render("error", {
      message: "Error al actualizar el aula en la base de datos",
      error: { status: 500, stack: err.stack },
    });
  }
});

// --- Rutas de Administración de Materias ---
// Ruta para crear una materia (POST)
app.post(
  "/admin/materias/crear",
  requireAuth,
  express.json(),
  async (req, res) => {
    let { nombre } = req.body;

    // Validación básica
    if (!nombre) {
      return res.status(400).json({
        success: false,
        message: "El nombre de la materia es obligatorio",
      });
    }

    nombre = nombre
      .trim()
      .toLowerCase()
      .replace(/\b\w/g, (c) => c.toUpperCase());

    try {
      // Verificar si ya existe una materia con ese nombre
      const existingMateria = await db.query(
        "SELECT materia_id FROM materias WHERE nombre = $1",
        [nombre]
      );

      if (existingMateria.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Ya existe una materia con ese nombre",
        });
      }

      // Insertar la nueva materia
      const result = await db.query(
        "INSERT INTO materias (nombre) VALUES ($1) RETURNING materia_id",
        [nombre]
      );

      res.status(201).json({
        success: true,
        message: "Materia creada correctamente",
        materia_id: result.rows[0].materia_id,
      });
    } catch (err) {
      console.error("Error al crear materia:", err);
      res.status(500).json({
        success: false,
        message: "Error al crear la materia en la base de datos",
        error: err.message,
      });
    }
  }
);

// Ruta para eliminar una materia (DELETE)
app.delete("/admin/materias/eliminar/:id", requireAuth, async (req, res) => {
  const materiaId = req.params.id;

  try {
    // Verificar si existe la materia
    const materia = await db.query(
      "SELECT materia_id FROM materias WHERE materia_id = $1",
      [materiaId]
    );

    if (materia.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Materia no encontrada",
      });
    }

    // Eliminar la materia
    await db.query("DELETE FROM materias WHERE materia_id = $1", [materiaId]);

    res.json({
      success: true,
      message: "Materia eliminada correctamente",
    });
  } catch (err) {
    console.error("Error al eliminar materia:", err);
    res.status(500).json({
      success: false,
      message: "Error al eliminar la materia de la base de datos",
      error: err.message,
    });
  }
});

// Ruta para mostrar el formulario de edición de materia
app.get("/admin/materias/editar/:id", requireAuth, async (req, res) => {
  const materiaId = req.params.id;

  try {
    // Obtener datos de la materia
    const result = await db.query(
      "SELECT materia_id, nombre FROM materias WHERE materia_id = $1",
      [materiaId]
    );

    if (result.rows.length === 0) {
      return res.status(404).render("error", {
        message: "Materia no encontrada",
        error: { status: 404 },
      });
    }

    const materia = result.rows[0];

    // Obtener los profesores que imparten esta materia
    const profesores = await db.queryAll(
      `SELECT p.profesor_id, p.nombre 
       FROM profesores p
       JOIN profesor_materia pm ON p.profesor_id = pm.profesor_id
       WHERE pm.materia_id = $1
       ORDER BY p.nombre ASC`,
      [materiaId]
    );

    res.render("materias_editar", {
      materia: materia,
      profesores: profesores,
      error: null,
    });
  } catch (err) {
    console.error("Error al cargar datos de la materia para editar:", err);
    res.status(500).render("error", {
      message: "Error al cargar datos de la materia",
      error: { status: 500, stack: err.stack },
    });
  }
});

// Ruta para procesar la actualización de una materia
app.post("/admin/materias/actualizar/:id", requireAuth, async (req, res) => {
  const materiaId = req.params.id;
  const { nombre } = req.body;

  // Validación básica
  if (!nombre) {
    return res.status(400).render("materias_editar", {
      materia: { materia_id: materiaId, nombre },
      profesores: [],
      error: "El nombre de la materia es obligatorio",
    });
  }

  try {
    // Verificar si el nombre ya está en uso por otra materia
    const existingMateria = await db.query(
      "SELECT materia_id FROM materias WHERE nombre = $1 AND materia_id != $2",
      [nombre, materiaId]
    );

    if (existingMateria.rows.length > 0) {
      // Volver a cargar los profesores para renderizar la página de edición
      const profesores = await db.queryAll(
        `SELECT p.profesor_id, p.nombre 
         FROM profesores p
         JOIN profesor_materia pm ON p.profesor_id = pm.profesor_id
         WHERE pm.materia_id = $1
         ORDER BY p.nombre ASC`,
        [materiaId]
      );

      return res.status(400).render("materias_editar", {
        materia: { materia_id: materiaId, nombre },
        profesores: profesores,
        error: "Ya existe otra materia con ese nombre",
      });
    }

    // Actualizar los datos de la materia
    await db.query("UPDATE materias SET nombre = $1 WHERE materia_id = $2", [
      nombre,
      materiaId,
    ]);

    // Redirigir al panel de administración
    req.session.message = "Materia actualizada correctamente";
    res.redirect("/db_admin");
  } catch (err) {
    console.error("Error al actualizar materia:", err);
    res.status(500).render("error", {
      message: "Error al actualizar la materia en la base de datos",
      error: { status: 500, stack: err.stack },
    });
  }
});

// --- Rutas de Administración de Asignaciones ---
// Ruta para crear una asignación (POST)
app.post(
  "/admin/asignaciones/crear",
  requireAuth,
  express.json(),
  async (req, res) => {
    const { profesor_id, materia_id } = req.body;

    // Validación básica
    if (!profesor_id || !materia_id) {
      return res.status(400).json({
        success: false,
        message: "El ID del profesor y de la materia son obligatorios",
      });
    }

    try {
      // Verificar si ya existe esta asignación
      const existingAsign = await db.query(
        "SELECT * FROM profesor_materia WHERE profesor_id = $1 AND materia_id = $2",
        [profesor_id, materia_id]
      );

      if (existingAsign.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Esta asignación ya existe",
        });
      }

      // Insertar la nueva asignación
      await db.query(
        "INSERT INTO profesor_materia (profesor_id, materia_id) VALUES ($1, $2)",
        [profesor_id, materia_id]
      );

      res.status(201).json({
        success: true,
        message: "Asignación creada correctamente",
      });
    } catch (err) {
      console.error("Error al crear asignación:", err);
      res.status(500).json({
        success: false,
        message: "Error al crear la asignación en la base de datos",
        error: err.message,
      });
    }
  }
);

// Ruta para eliminar una asignación (DELETE)
app.delete(
  "/admin/asignaciones/eliminar",
  requireAuth,
  express.json(),
  async (req, res) => {
    const { profesor_id, materia_id } = req.body;

    // Validación básica
    if (!profesor_id || !materia_id) {
      return res.status(400).json({
        success: false,
        message: "El ID del profesor y de la materia son obligatorios",
      });
    }

    try {
      // Eliminar la asignación
      const result = await db.query(
        "DELETE FROM profesor_materia WHERE profesor_id = $1 AND materia_id = $2 RETURNING *",
        [profesor_id, materia_id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: "Asignación no encontrada",
        });
      }

      res.json({
        success: true,
        message: "Asignación eliminada correctamente",
      });
    } catch (err) {
      console.error("Error al eliminar asignación:", err);
      res.status(500).json({
        success: false,
        message: "Error al eliminar la asignación de la base de datos",
        error: err.message,
      });
    }
  }
);

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
    const [profesores, aulas, materias, asignaciones] = await Promise.all([
      db.queryAll(
        "SELECT profesor_id, nombre, email, tarjeta_id FROM profesores ORDER BY nombre ASC"
      ),
      db.queryAll(
        "SELECT aula_id, nombre, esp32_id FROM aulas ORDER BY nombre ASC"
      ),
      db.queryAll(
        "SELECT materia_id, nombre FROM materias ORDER BY nombre ASC"
      ),
      db.queryAll(
        `SELECT 
          pm.profesor_id, 
          pm.materia_id, 
          p.nombre AS profesor_nombre, 
          m.nombre AS materia_nombre
         FROM profesor_materia pm
         JOIN profesores p ON pm.profesor_id = p.profesor_id
         JOIN materias m ON pm.materia_id = m.materia_id
         ORDER BY p.nombre ASC, m.nombre ASC`
      ),
    ]);

    res.render("db_admin", {
      profesores: profesores,
      aulas: aulas,
      materias: materias,
      asignaciones: asignaciones,
      error: null,
    });
  } catch (err) {
    console.error("Error al cargar datos para el panel de admin:", err);
    res.render("db_admin", {
      // Renderizar igual pero mostrando un error
      profesores: [],
      aulas: [],
      materias: [],
      asignaciones: [],
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
