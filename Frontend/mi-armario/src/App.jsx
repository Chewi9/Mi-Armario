import { useState, useRef, useEffect } from 'react'
import { supabase } from './supabase'
import './App.css'

const CATEGORIAS = ['Todas', 'Pantalones', 'Camisetas', 'Abrigos', 'Zapatos', 'Bolsos']

function App() {

  // Autenticación
  const [usuario, setUsuario] = useState(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [modoRegistro, setModoRegistro] = useState(false)
  const [cargandoAuth, setCargandoAuth] = useState(false)

  // Armario
  const [ropa, setRopa] = useState([])
  const [filtroActivo, setFiltroActivo] = useState('Todas')
  const [mostrarModal, setMostrarModal] = useState(false)
  const [cargando, setCargando] = useState(false)
  const [nuevaPrenda, setNuevaPrenda] = useState({ nombre: '', categoria: 'Pantalones', archivo: null, preview: '' })
  const [prendaSeleccionada, setPrendaSeleccionada] = useState(null)
  const fileInputRef = useRef(null)


  // Sesión del usuario
  useEffect(() => {
    supabase.auth.getSession().then(({ data: {session } }) => {
      setUsuario(session?.user ?? null)
    })

    const {data: {subscription }} = supabase.auth.onAuthStateChange((_event, session) => {
      setUsuario(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (usuario) obtenerRopa()
  }, [usuario])

  const obtenerRopa = async () => {
    const { data, error } = await supabase.from('ropa').select('*').order('created_at', { ascending: false })
    if (error) console.error("Error al cargar:", error)
    else setRopa(data)
  }

  const ropaFiltrada = filtroActivo === 'Todas' 
    ? ropa 
    : ropa.filter(prenda => prenda.categoria === filtroActivo)

  const manejarSubidaImagen = (e) => {
    const file = e.target.files[0]
    if (file) {
      const urlTemporal = URL.createObjectURL(file)
      setNuevaPrenda({ ...nuevaPrenda, archivo: file, preview: urlTemporal })
    }
  }

  // 2. Guardar en Supabase (Storage + Base de datos)
  const guardarPrenda = async (e) => {
    e.preventDefault()
    if (!nuevaPrenda.archivo) return alert("Por favor, sube una imagen")
    
    setCargando(true)
    try {
      // A. Subir imagen al Bucket
        const extension = nuevaPrenda.archivo.name.split('.').pop()
        const nombreArchivo = `${Date.now()}.${extension}`      
        const { error: errorStorage } = await supabase.storage
        .from('imagenes_ropa')
        .upload(nombreArchivo, nuevaPrenda.archivo)

      if (errorStorage) throw errorStorage

      // B. Obtener URL pública de la imagen
      const { data: { publicUrl } } = supabase.storage
        .from('imagenes_ropa')
        .getPublicUrl(nombreArchivo)

      // C. Guardar datos en la tabla
      const { error: errorDB } = await supabase.from('ropa').insert([
        { 
          nombre: nuevaPrenda.nombre, 
          categoria: nuevaPrenda.categoria, 
          imagen_url: publicUrl 
        }
      ])

      if (errorDB) throw errorDB

      // D. Refrescar la galería y cerrar modal
      await obtenerRopa()
      cerrarModal()
    } catch (error) {
      alert("Error al guardar: " + error.message)
    } finally {
      setCargando(false)
    }
  }

  const cerrarModal = () => {
    setMostrarModal(false)
    setNuevaPrenda({ nombre: '', categoria: 'Pantalones', archivo: null, preview: '' })
  }

  // 3. Eliminar de Supabase
  const eliminarPrenda = async (id, imagen_url) => {
    // Extraemos el nombre del archivo de la URL para borrarlo del Storage
    const nombreArchivo = imagen_url.split('/').pop()
    
    await supabase.storage.from('imagenes_ropa').remove([nombreArchivo])
    await supabase.from('ropa').delete().eq('id', id)
    
    setPrendaSeleccionada(null)
    obtenerRopa() // Refrescar la galería
  }

  // Autenticación
  const manejarAuth = async (e) => {
    e.preventDefault()
    setCargandoAuth(true)
    try {
      if (modoRegistro) {
        const { error } = await supabase.auth.signUp({email, password})
        if (error) throw error
        alert("Cuenta creada con éxito. Ya puedes iniciar sesión.")
        setModoRegistro(false)
      } else {
        const {error} = await supabase.auth.signInWithPassword({email, password})
        if (error) throw error
      }
    } catch(error) {
      alert("Error: " + error.message)
    } finally {
      setCargandoAuth(false)
    }
  }

  const cerrarSesion = async () => {
    await supabase.auth.signOut()
    setRopa([]) // Limpiamos ropa
  }

  // Pantalla login si no hay usuario
  if (!usuario) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <form onSubmit={manejarAuth} className="modal-contenido" style={{ width: '100%', maxWidth: '400px' }}>
          <h2>{modoRegistro ? 'Crear cuenta' : 'Iniciar sesión'}</h2>
          
          <div className="campo">
            <label>Email:</label>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} disabled={cargandoAuth} />
          </div>
          
          <div className="campo">
            <label>Contraseña:</label>
            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} disabled={cargandoAuth} minLength="6" />
          </div>

          <button type="submit" className="btn-guardar" style={{ width: '100%', marginTop: '15px' }} disabled={cargandoAuth}>
            {cargandoAuth ? 'Cargando...' : (modoRegistro ? 'Registrarse' : 'Entrar')}
          </button>
          
          <p style={{ textAlign: 'center', marginTop: '15px', cursor: 'pointer', color: '#666' }} onClick={() => setModoRegistro(!modoRegistro)}>
            {modoRegistro ? '¿Ya tienes cuenta? Inicia sesión' : '¿No tienes cuenta? Regístrate'}
          </p>
        </form>
      </div>
    )
  }

  // Pantalla principal
  return (
    <div className="app-container">
      <header className="topbar">
        <h2>Mi Armario</h2>
        <div className="topbar-actions">
          <span style={{ fontSize: '0.8rem', color: '#666' }}>{usuario.email}</span>
          <button onClick={cerrarSesion} className="btn-cancelar" style={{ padding: '6px 12px', fontSize: '0.85rem' }}>Salir</button>
        </div>
      </header>

      <div className="header-actions">
        <h1>Gallery</h1>
        <button className="btn-anadir-nuevo" onClick={() => setMostrarModal(true)}>
          Añadir nueva prenda
        </button>
      </div>

      <nav className="filtros">
        {CATEGORIAS.map(categoria => (
          <button 
            key={categoria}
            className={`btn-filtro ${filtroActivo === categoria ? 'activo' : ''}`}
            onClick={() => setFiltroActivo(categoria)}
          >
            {categoria}
          </button>
        ))}
      </nav>

      <main className="galeria">
        {ropaFiltrada.map(prenda => (
          <div key={prenda.id} className="tarjeta-prenda" onClick={() => setPrendaSeleccionada(prenda)}>
            <div className="imagen-contenedor">
              <img src={prenda.imagen_url} alt={prenda.nombre} />
            </div>
            <div className="info-prenda">
              <h3>{prenda.nombre}</h3>
              <span className="etiqueta-categoria">{prenda.categoria}</span>
            </div>
          </div>
        ))}
      </main>

      {/* MODAL PARA AÑADIR */}
      {mostrarModal && (
        <div className="modal-fondo">
          <div className="modal-contenido">
            <h2>Añadir nueva prenda</h2>
            <form onSubmit={guardarPrenda} className="formulario">
              
              <div className="campo">
                <label>Nombre:</label>
                <input 
                  type="text" 
                  required 
                  value={nuevaPrenda.nombre}
                  onChange={(e) => setNuevaPrenda({...nuevaPrenda, nombre: e.target.value})}
                  disabled={cargando}
                />
              </div>

              <div className="campo">
                <label>Categoría:</label>
                <select 
                  value={nuevaPrenda.categoria}
                  onChange={(e) => setNuevaPrenda({...nuevaPrenda, categoria: e.target.value})}
                  disabled={cargando}
                >
                  {CATEGORIAS.filter(c => c !== 'Todas').map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="zona-subida-container">
                <div className="preview-circular">
                  {nuevaPrenda.preview ? (
                    <img src={nuevaPrenda.preview} alt="Preview" />
                  ) : (
                    <div className="preview-vacia"></div>
                  )}
                </div>

                <div className="caja-subida" onClick={() => !cargando && fileInputRef.current.click()}>
                  <input 
                    type="file" 
                    accept="image/*" 
                    hidden 
                    ref={fileInputRef}
                    onChange={manejarSubidaImagen}
                    disabled={cargando}
                  />
                  <div className="caja-subida-contenido">
                    <p className="texto-subida">
                      {cargando ? "Subiendo..." : "Subir imagen local"}
                    </p>
                    {!cargando && <div className="btn-seleccionar">Seleccionar imagen</div>}
                  </div>
                </div>
              </div>

              <div className="modal-botones">
                <button type="button" className="btn-cancelar" onClick={cerrarModal} disabled={cargando}>Cancelar</button>
                <button type="submit" className="btn-guardar" disabled={cargando}>
                  {cargando ? 'Guardando...' : 'Guardar Prenda'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE DETALLE */}
      {prendaSeleccionada && (
        <div className="modal-fondo">
          <div className="modal-contenido modal-detalle">
            <div className="detalle-imagen">
              <img src={prendaSeleccionada.imagen_url} alt={prendaSeleccionada.nombre} />
            </div>
            
            <div className="detalle-info">
              <h2>{prendaSeleccionada.nombre}</h2>
              <span className="etiqueta-categoria">{prendaSeleccionada.categoria}</span>
            </div>

            <div className="modal-botones botones-detalle">
              <button type="button" className="btn-volver" onClick={() => setPrendaSeleccionada(null)}>
                Volver
              </button>
              <button 
                type="button" 
                className="btn-eliminar" 
                onClick={() => eliminarPrenda(prendaSeleccionada.id, prendaSeleccionada.imagen_url)}
              >
                Eliminar prenda
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  )
}

export default App