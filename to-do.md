# To-Do

## Conectar el Frontend a la Base de Datos

Al hacer eso, volar movies.db y adaptar para nueva db (cambiar actores a profesores, películas a materias, etc.)

### Funcionalidades:

1. **Buscar Info**:

   - Profesores + sus ubicaciones, etc.
   - Materias.

2. **Administrar Profesores y Materias**:

   - Agregar nuevos profesores/materias.
   - Borrar profesores/materias existentes.

## Conectar MQTT

### A front (funcionalidades):

1. **Enviar consulta a profesor**:
   Desde view del profesor concreto
   NO VER FORM SI NO ESTA AVAILABLE -> script

### A db (funcionalidades):

1. **Write check-in updates de la tarjeta**:
   Cuando un profesor marque entrada / salida con la tarjeta, registrarlo en la db (duda relación P-en->aula: cuando sale, no longer "en" una aula... pero bueno, ver cómo manejamos eso)

2. **Alguna otra de db a MQTT o al revés??**:
   En todo caso sería de "front" (website) a db a MQTT... pero bueno.

## Extras

### CONTRASEÑA ADMIN! -> crear admin table + encryption...

    Or hide admin en una página distinta

### Sacar "front" de localhost (vercel / netlify)

### Hacer responsive?

### "Lucecita" verde/roja para profesor en el campus/fuera

### Seguridad db, conexiones, cuentas...?

### Agregar aulas thru db_admin?

### Entender bien código db_admin.ejs

### Unificar css? (clean up)
