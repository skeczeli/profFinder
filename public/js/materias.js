document.addEventListener('DOMContentLoaded', function() {
    // Referencias a elementos del DOM
    const nombreMateriaInput = document.getElementById('materia-nombre');
    const guardarMateriaBtn = document.getElementById('guardar-materia');
  
    // Evento para guardar materia
    if (guardarMateriaBtn){
      guardarMateriaBtn.addEventListener("click", async function (){
        // Validación básica
        if (!nombreMateriaInput.value.trim()) {
          alert("Por favor ingrese el nombre de la materia");
          return;
        }
        // Preparar datos para enviar
        const materiaData = {
          nombre: nombreMateriaInput.value.trim()
        };

        try {
          const response = await fetch("/admin/materias/crear", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(materiaData),
          });

          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || "Error al guardar materia");
          }

          alert("Materia guardada correctamente");

          // Limpiar formulario
          nombreMateriaInput.value = "";

          // Recargar la página para mostrar la nueva materia
          window.location.reload();
        } catch (error) {
          alert(`Error: ${error.message}`);
        }
        });
        }
  
// Manejar botones de eliminar en la tabla
const botonesEliminarTabla = document.querySelectorAll('#tabla-materias .btn-eliminar');
botonesEliminarTabla.forEach(btn => {
  btn.addEventListener('click', async function(e) {
    e.preventDefault(); // Prevenir comportamiento por defecto
    
    const materiaId = this.getAttribute('data-id'); 
    
    if (!materiaId) {
      alert("Error: No se pudo obtener el id de la materia");
      return;
    }
    
    // Agregar la confirmación antes de eliminar
    if (!confirm("¿Está seguro que desea eliminar esta materia?")) {
      return;
    }
    
    try {
      const response = await fetch(`/admin/materias/eliminar/${materiaId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error al eliminar la materia");
      }

      alert("Materia eliminada correctamente");
      
      // Recargar la página
      window.location.reload();
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  });
});
});