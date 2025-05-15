document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const profesorSelect = document.getElementById('asign-profesor');
    const materiaSelect = document.getElementById('asign-materia');
    const guardarAsignacionBtn = document.getElementById('guardar-asignacion');
  
    // Evento para guardar asignación
    if (guardarAsignacionBtn){
      guardarAsignacionBtn.addEventListener("click", async function (){
        // Validación básica
        if (!profesorSelect.value.trim()) {
          alert("Por favor seleccione un profesor");
          return;
        }
        
        if (!materiaSelect.value.trim()) {
          alert("Por favor seleccione una materia");
          return;
        }
        
        // Preparar datos para enviar
        const asignacionData = {
          profesor_id: profesorSelect.value.trim(),
          materia_id: materiaSelect.value.trim()
        };

        try {
          const response = await fetch("/admin/asignaciones/crear", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(asignacionData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Error al guardar asignación");
          }

          alert("Asignación guardada correctamente");

          // Limpiar formulario
          profesorSelect.selectedIndex = 0;
          materiaSelect.selectedIndex = 0;

          // Recargar la página para mostrar la nueva asignación
          window.location.reload();
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
        });
        }
  
// Manejar botones de eliminar en la tabla
const botonesEliminarTabla = document.querySelectorAll('#tabla-asignaciones .btn-eliminar');
botonesEliminarTabla.forEach(btn => {
  btn.addEventListener('click', async function(e) {
    e.preventDefault(); // Prevenir comportamiento por defecto
    
    const profesorId = this.getAttribute('data-profesor-id');
    const materiaId = this.getAttribute('data-materia-id');

    
    if (!asignacionId) {
      alert("Error: No se pudo obtener el id de la asignación");
      return;
    }
    
    // Agregar la confirmación antes de eliminar
    if (!confirm("¿Está seguro que desea eliminar esta asignación?")) {
      return;
    }
    
    try {
      const response = await fetch(`/admin/asignaciones/eliminar`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profesor_id: profesorId,
          materia_id: materiaId
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al eliminar la asignación");
      }

      alert("Asignación eliminada correctamente");
      
      // Recargar la página
      window.location.reload();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });
});

// Manejar el botón "Eliminar Asignación" del formulario
const borrarAsignacionBtn = document.getElementById('borrar-asignacion');
if (borrarAsignacionBtn) {
  borrarAsignacionBtn.addEventListener('click', async function() {
    // Validación básica
    if (!profesorSelect.value.trim()) {
      alert("Por favor seleccione un profesor para eliminar la asignación");
      return;
    }
    
    if (!materiaSelect.value.trim()) {
      alert("Por favor seleccione una materia para eliminar la asignación");
      return;
    }
    
    // Confirmar antes de eliminar
    if (!confirm("¿Está seguro que desea eliminar esta asignación?")) {
      return;
    }
    
    try {
      const response = await fetch(`/admin/asignaciones/eliminar`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          profesor_id: profesorSelect.value.trim(),
          materia_id: materiaSelect.value.trim()
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al eliminar la asignación");
      }

      alert("Asignación eliminada correctamente");
      
      // Limpiar formulario
      profesorSelect.selectedIndex = 0;
      materiaSelect.selectedIndex = 0;
      
      // Recargar la página
      window.location.reload();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });
}
});