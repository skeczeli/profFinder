document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const nombreAulaInput = document.getElementById('aula-nombre');
    const esp32Input = document.getElementById('aula-esp32');
    const guardarAulaBtn = document.getElementById('guardar-aula');
    const borrarAulaBtn = document.getElementById('borrar-aula');
    const tbodyAulas = document.getElementById('tbody-aulas');
  
    // Cargar la lista de aulas al iniciar
    cargarAulas();
  
    // Evento para guardar aula
    guardarAulaBtn.addEventListener('click', function() {
      const nombre = nombreAulaInput.value.trim();
      const esp32Id = esp32Input.value.trim();
      
      if (!nombre || !esp32Id) {
        alert('Por favor, ingrese el nombre del aula y el ID del ESP32');
        return;
      }
      
      guardarAula(nombre, esp32Id);
    });
  
    // Delegación de eventos para los botones de eliminar en la tabla
    tbodyAulas.addEventListener('click', function(e) {
      if (e.target.classList.contains('btn-eliminar')) {
        const esp32Id = e.target.getAttribute('data-id');
        if (confirm('¿Está seguro que desea eliminar esta aula?')) {
          eliminarAula(esp32Id);
        }
      }
    });
    
    // También conectar el botón general de eliminar (si se usa)
    if (borrarAulaBtn) {
      borrarAulaBtn.addEventListener('click', function() {
        const esp32Id = prompt('Ingrese el ID del ESP32 del aula que desea eliminar:');
        if (esp32Id) {
          eliminarAula(esp32Id);
        }
      });
    }
    
    // Función para guardar un aula nueva
    function guardarAula(nombre, esp32Id) {
      // Datos a enviar
      const data = {
        nombre: nombre,
        esp32_id: esp32Id
      };
      
      // Enviar petición al servidor
      fetch('/admin/aulas/crear', {  // Modificado para usar la ruta correcta
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw new Error(err.message || 'Error al guardar el aula'); });
        }
        return response.json();
      })
      .then(data => {
        alert('Aula guardada correctamente');
        // Limpiar el formulario
        nombreAulaInput.value = '';
        esp32Input.value = '';
        // Recargar la lista de aulas
        cargarAulas();
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Error al guardar el aula: ' + error.message);
      });
    }
  
    // Función para eliminar un aula
    function eliminarAula(esp32Id) {
      fetch(`/admin/aulas/eliminar/${esp32Id}`, {  // Modificado para usar la ruta correcta
        method: 'DELETE',
      })
      .then(response => {
        if (!response.ok) {
          return response.json().then(err => { throw new Error(err.message || 'Error al eliminar el aula'); });
        }
        return response.json();
      })
      .then(data => {
        alert('Aula eliminada correctamente');
        // Recargar la lista de aulas
        cargarAulas();
      })
      .catch(error => {
        console.error('Error:', error);
        alert('Error al eliminar el aula: ' + error.message);
      });
    }
  
    // Función para cargar la lista de aulas desde el servidor
    function cargarAulas() {
      // Modificado para usar la ruta del panel de administración que ya devuelve la lista de aulas
      fetch('/db_admin')
        .then(response => {
          if (!response.ok) {
            throw new Error('Error al cargar las aulas');
          }
          // Como db_admin devuelve HTML, necesitamos parsear el HTML para extraer los datos de las aulas
          return response.text();
        })
        .then(html => {
          // Crear un parser temporal
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          
          // Buscar la tabla de aulas
          const tableRows = doc.querySelectorAll('table#aulas-table tbody tr');
          
          // Convertir los datos de la tabla a un array de objetos
          const aulas = Array.from(tableRows).map(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 3) {
              return {
                nombre: cells[0].textContent,
                esp32_id: cells[1].textContent,
                aula_id: cells[2].textContent
              };
            }
            return null;
          }).filter(aula => aula !== null);
          
          actualizarTablaAulas(aulas);
        })
        .catch(error => {
          console.error('Error:', error);
          // Alternativa: hacer una consulta directa al endpoint existente
          // Como fallback, intentamos obtener las aulas directamente desde la base de datos
          fetch('/test-db')
            .then(response => response.json())
            .then(() => {
              // Si la conexión a la BD está bien, intentamos renderizar la página de db_admin manualmente
              tbodyAulas.innerHTML = `<tr><td colspan="4">Error al cargar las aulas automáticamente. Por favor, recargue la página.</td></tr>`;
            })
            .catch(err => {
              tbodyAulas.innerHTML = `<tr><td colspan="4">Error al cargar las aulas: ${error.message}</td></tr>`;
            });
        });
    }
  
    // Función para actualizar la tabla con los datos recibidos
    function actualizarTablaAulas(aulas) {
      // Limpiar la tabla
      tbodyAulas.innerHTML = '';
      
      if (aulas && aulas.length > 0) {
        // Agregar cada aula a la tabla
        aulas.forEach(aula => {
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>${aula.nombre}</td>
            <td>${aula.esp32_id || '-'}</td>
            <td>${aula.aula_id}</td>
            <td>
              <a href="/admin/aulas/editar/${aula.aula_id}" class="btn-editar">Editar</a>
              <button class="btn-eliminar" data-id="${aula.esp32_id}">Eliminar</button>
            </td>
          `;
          tbodyAulas.appendChild(tr);
        });
      } else {
        // Mostrar mensaje si no hay aulas
        tbodyAulas.innerHTML = '<tr><td colspan="4">No hay aulas registradas.</td></tr>';
      }
    }
});