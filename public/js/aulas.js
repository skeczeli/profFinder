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
      
      if (!nombre) {
        alert('Por favor, ingrese el nombre del aula');
        return;
      }
      
      guardarAula(nombre, esp32Id);
    });
  
    // Delegación de eventos para los botones de eliminar en la tabla
    tbodyAulas.addEventListener('click', function(e) {
      if (e.target.classList.contains('btn-eliminar')) {
        const aulaId = e.target.getAttribute('data-id');
        if (confirm('¿Está seguro que desea eliminar esta aula?')) {
          eliminarAula(aulaId);
        }
      }
    });
    
    // También conectar el botón general de eliminar (si se usa)
    borrarAulaBtn.addEventListener('click', function() {
      const aulaId = prompt('Ingrese el ID del aula que desea eliminar:');
      if (aulaId) {
        eliminarAula(aulaId);
      }
    });
    
    // Función para guardar un aula nueva
    function guardarAula(nombre, esp32Id) {
      // Datos a enviar
      const data = {
        nombre: nombre,
        esp32_id: esp32Id
      };
      
      // Enviar petición al servidor
      fetch('/admin/aulas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data)
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Error al guardar el aula');
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
    function eliminarAula(aulaId) {
      fetch(`/admin/aulas/${aulaId}`, {
        method: 'DELETE',
      })
      .then(response => {
        if (!response.ok) {
          throw new Error('Error al eliminar el aula');
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
      fetch('/admin/aulas')
        .then(response => {
          if (!response.ok) {
            throw new Error('Error al cargar las aulas');
          }
          return response.json();
        })
        .then(aulas => {
          actualizarTablaAulas(aulas);
        })
        .catch(error => {
          console.error('Error:', error);
          tbodyAulas.innerHTML = `<tr><td colspan="4">Error al cargar las aulas: ${error.message}</td></tr>`;
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
              <button class="btn-eliminar" data-id="${aula.aula_id}">Eliminar</button>
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