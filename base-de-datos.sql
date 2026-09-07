-- =====================================================================
-- Sistema de Gestión de Ventas e Inventario — esquema para Supabase
-- Ejecutar completo en: Supabase Dashboard -> SQL Editor -> New query
-- Este archivo NO se despliega con la app; se corre una sola vez (y de
-- nuevo cada vez que cambies el esquema) directamente en Supabase.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. TABLAS
-- ---------------------------------------------------------------------

create table if not exists public.negocios (
    id          uuid primary key default gen_random_uuid(),
    nombre      text not null,
    ruc         text,
    creado_en   timestamptz not null default now()
);

create table if not exists public.usuarios (
    id               uuid primary key references auth.users(id) on delete cascade,
    negocio_id       uuid not null references public.negocios(id) on delete cascade,
    nombre_completo  text not null,
    rol              text not null check (rol in ('admin', 'vendedor')),
    activo           boolean not null default true,
    creado_en        timestamptz not null default now()
);

create table if not exists public.categorias (
    id          uuid primary key default gen_random_uuid(),
    negocio_id  uuid not null references public.negocios(id) on delete cascade,
    nombre      text not null,
    descripcion text default '',
    activo      boolean not null default true,
    creado_en   timestamptz not null default now()
);

create table if not exists public.productos (
    id            uuid primary key default gen_random_uuid(),
    negocio_id    uuid not null references public.negocios(id) on delete cascade,
    categoria_id  uuid references public.categorias(id) on delete set null,
    nombre        text not null,
    descripcion   text default '',
    precio        numeric(12, 2) not null check (precio >= 0),
    stock         integer not null default 0 check (stock >= 0),
    stock_minimo  integer not null default 0 check (stock_minimo >= 0),
    activo        boolean not null default true,
    creado_en     timestamptz not null default now(),
    actualizado_en timestamptz not null default now()
);

create table if not exists public.clientes (
    id          uuid primary key default gen_random_uuid(),
    negocio_id  uuid not null references public.negocios(id) on delete cascade,
    nombre      text not null,
    documento   text default '',
    telefono    text default '',
    email       text default '',
    direccion   text default '',
    activo      boolean not null default true,
    creado_en   timestamptz not null default now()
);

create table if not exists public.ventas (
    id          uuid primary key default gen_random_uuid(),
    negocio_id  uuid not null references public.negocios(id) on delete cascade,
    cliente_id  uuid references public.clientes(id) on delete set null,
    usuario_id  uuid not null references public.usuarios(id),
    total       numeric(12, 2) not null default 0 check (total >= 0),
    estado      text not null default 'completada' check (estado in ('completada', 'anulada')),
    creado_en   timestamptz not null default now()
);

create table if not exists public.detalle_ventas (
    id              uuid primary key default gen_random_uuid(),
    venta_id        uuid not null references public.ventas(id) on delete cascade,
    producto_id     uuid not null references public.productos(id),
    cantidad        integer not null check (cantidad > 0),
    precio_unitario numeric(12, 2) not null check (precio_unitario >= 0),
    subtotal        numeric(12, 2) not null check (subtotal >= 0)
);

create table if not exists public.movimientos_inventario (
    id               uuid primary key default gen_random_uuid(),
    negocio_id       uuid not null references public.negocios(id) on delete cascade,
    producto_id      uuid not null references public.productos(id),
    tipo             text not null check (tipo in ('ENTRADA', 'SALIDA', 'AJUSTE', 'VENTA', 'DEVOLUCION')),
    cantidad         integer not null check (cantidad > 0),
    stock_resultante integer not null check (stock_resultante >= 0),
    usuario_id       uuid not null references public.usuarios(id),
    motivo           text default '',
    creado_en        timestamptz not null default now()
);

create index if not exists idx_productos_negocio on public.productos(negocio_id);
create index if not exists idx_clientes_negocio on public.clientes(negocio_id);
create index if not exists idx_ventas_negocio on public.ventas(negocio_id);
create index if not exists idx_ventas_creado_en on public.ventas(creado_en);
create index if not exists idx_detalle_ventas_venta on public.detalle_ventas(venta_id);
create index if not exists idx_movimientos_producto on public.movimientos_inventario(producto_id);

-- ---------------------------------------------------------------------
-- 2. FUNCIONES DE APOYO PARA RLS (negocio y rol del usuario actual)
-- ---------------------------------------------------------------------

create or replace function public.negocio_actual()
returns uuid
language sql
security definer
stable
as $$
    select negocio_id from public.usuarios where id = auth.uid();
$$;

create or replace function public.rol_actual()
returns text
language sql
security definer
stable
as $$
    select rol from public.usuarios where id = auth.uid();
$$;

-- ---------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
-- ---------------------------------------------------------------------

alter table public.negocios enable row level security;
alter table public.usuarios enable row level security;
alter table public.categorias enable row level security;
alter table public.productos enable row level security;
alter table public.clientes enable row level security;
alter table public.ventas enable row level security;
alter table public.detalle_ventas enable row level security;
alter table public.movimientos_inventario enable row level security;

-- negocios: cada usuario solo ve su propio negocio.
create policy "negocios_select_propio" on public.negocios
    for select using (id = public.negocio_actual());

-- usuarios: solo perfiles del mismo negocio; solo admin modifica.
create policy "usuarios_select_mismo_negocio" on public.usuarios
    for select using (negocio_id = public.negocio_actual());

create policy "usuarios_update_admin" on public.usuarios
    for update using (
        negocio_id = public.negocio_actual() and public.rol_actual() = 'admin'
    );

-- categorias: lectura para todo el negocio, escritura solo admin.
create policy "categorias_select" on public.categorias
    for select using (negocio_id = public.negocio_actual());
create policy "categorias_insert_admin" on public.categorias
    for insert with check (
        negocio_id = public.negocio_actual() and public.rol_actual() = 'admin'
    );
create policy "categorias_update_admin" on public.categorias
    for update using (
        negocio_id = public.negocio_actual() and public.rol_actual() = 'admin'
    );

-- productos: lectura para todo el negocio, escritura solo admin.
create policy "productos_select" on public.productos
    for select using (negocio_id = public.negocio_actual());
create policy "productos_insert_admin" on public.productos
    for insert with check (
        negocio_id = public.negocio_actual() and public.rol_actual() = 'admin'
    );
create policy "productos_update_admin" on public.productos
    for update using (
        negocio_id = public.negocio_actual() and public.rol_actual() = 'admin'
    );

-- clientes: lectura y creación para todo el negocio; solo admin desactiva.
create policy "clientes_select" on public.clientes
    for select using (negocio_id = public.negocio_actual());
create policy "clientes_insert" on public.clientes
    for insert with check (negocio_id = public.negocio_actual());
create policy "clientes_update" on public.clientes
    for update using (negocio_id = public.negocio_actual());

-- ventas: todo el negocio puede ver y crear (vía RPC); nadie actualiza
-- directo por REST, la anulación también pasa por RPC (security definer).
create policy "ventas_select" on public.ventas
    for select using (negocio_id = public.negocio_actual());
create policy "ventas_insert" on public.ventas
    for insert with check (negocio_id = public.negocio_actual());

-- detalle_ventas: visible si la venta pertenece al negocio.
create policy "detalle_ventas_select" on public.detalle_ventas
    for select using (
        exists (
            select 1 from public.ventas v
            where v.id = detalle_ventas.venta_id
              and v.negocio_id = public.negocio_actual()
        )
    );
create policy "detalle_ventas_insert" on public.detalle_ventas
    for insert with check (
        exists (
            select 1 from public.ventas v
            where v.id = detalle_ventas.venta_id
              and v.negocio_id = public.negocio_actual()
        )
    );

-- movimientos_inventario: todo el negocio ve; inserciones manuales solo
-- admin (las de VENTA/DEVOLUCION las crea el RPC con security definer).
create policy "movimientos_select" on public.movimientos_inventario
    for select using (negocio_id = public.negocio_actual());
create policy "movimientos_insert_admin" on public.movimientos_inventario
    for insert with check (
        negocio_id = public.negocio_actual() and public.rol_actual() = 'admin'
    );

-- ---------------------------------------------------------------------
-- 4. FUNCIÓN RPC: registrar movimiento manual de inventario
-- ---------------------------------------------------------------------

create or replace function public.registrar_movimiento_inventario(
    p_producto_id uuid,
    p_tipo text,
    p_cantidad integer,
    p_usuario_id uuid,
    p_motivo text default ''
)
returns public.movimientos_inventario
language plpgsql
security definer
as $$
declare
    v_negocio_id uuid := public.negocio_actual();
    v_stock_actual integer;
    v_stock_nuevo integer;
    v_movimiento public.movimientos_inventario;
begin
    if p_tipo not in ('ENTRADA', 'SALIDA', 'AJUSTE') then
        raise exception 'Tipo de movimiento inválido para carga manual: %', p_tipo;
    end if;

    select stock into v_stock_actual
    from public.productos
    where id = p_producto_id and negocio_id = v_negocio_id
    for update;

    if v_stock_actual is null then
        raise exception 'Producto no encontrado en este negocio.';
    end if;

    if p_tipo = 'ENTRADA' then
        v_stock_nuevo := v_stock_actual + p_cantidad;
    elsif p_tipo = 'SALIDA' then
        if v_stock_actual < p_cantidad then
            raise exception 'Stock insuficiente para la salida.';
        end if;
        v_stock_nuevo := v_stock_actual - p_cantidad;
    else -- AJUSTE: la cantidad enviada es el nuevo stock exacto.
        v_stock_nuevo := p_cantidad;
    end if;

    update public.productos
    set stock = v_stock_nuevo, actualizado_en = now()
    where id = p_producto_id;

    insert into public.movimientos_inventario (
        negocio_id, producto_id, tipo, cantidad, stock_resultante, usuario_id, motivo
    ) values (
        v_negocio_id, p_producto_id, p_tipo, p_cantidad, v_stock_nuevo, p_usuario_id, p_motivo
    )
    returning * into v_movimiento;

    return v_movimiento;
end;
$$;

-- ---------------------------------------------------------------------
-- 5. FUNCIÓN RPC: registrar una venta completa (atómica)
-- ---------------------------------------------------------------------

create or replace function public.registrar_venta(
    p_cliente_id uuid,
    p_usuario_id uuid,
    p_items jsonb
)
returns public.ventas
language plpgsql
security definer
as $$
declare
    v_negocio_id uuid := public.negocio_actual();
    v_venta public.ventas;
    v_item jsonb;
    v_producto_id uuid;
    v_cantidad integer;
    v_precio numeric(12, 2);
    v_stock_actual integer;
    v_stock_nuevo integer;
    v_subtotal numeric(12, 2);
    v_total numeric(12, 2) := 0;
begin
    insert into public.ventas (negocio_id, cliente_id, usuario_id, total, estado)
    values (v_negocio_id, p_cliente_id, p_usuario_id, 0, 'completada')
    returning * into v_venta;

    for v_item in select * from jsonb_array_elements(p_items)
    loop
        v_producto_id := (v_item ->> 'producto_id')::uuid;
        v_cantidad := (v_item ->> 'cantidad')::integer;

        select precio, stock into v_precio, v_stock_actual
        from public.productos
        where id = v_producto_id and negocio_id = v_negocio_id and activo = true
        for update;

        if v_precio is null then
            raise exception 'Producto % no encontrado o inactivo.', v_producto_id;
        end if;

        if v_stock_actual < v_cantidad then
            raise exception 'Stock insuficiente para el producto %.', v_producto_id;
        end if;

        v_subtotal := v_precio * v_cantidad;
        v_total := v_total + v_subtotal;
        v_stock_nuevo := v_stock_actual - v_cantidad;

        insert into public.detalle_ventas (venta_id, producto_id, cantidad, precio_unitario, subtotal)
        values (v_venta.id, v_producto_id, v_cantidad, v_precio, v_subtotal);

        update public.productos
        set stock = v_stock_nuevo, actualizado_en = now()
        where id = v_producto_id;

        insert into public.movimientos_inventario (
            negocio_id, producto_id, tipo, cantidad, stock_resultante, usuario_id, motivo
        ) values (
            v_negocio_id, v_producto_id, 'VENTA', v_cantidad, v_stock_nuevo, p_usuario_id,
            'Venta ' || v_venta.id
        );
    end loop;

    update public.ventas set total = v_total where id = v_venta.id
    returning * into v_venta;

    return v_venta;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. FUNCIÓN RPC: anular una venta (repone stock vía DEVOLUCION)
-- ---------------------------------------------------------------------

create or replace function public.anular_venta(
    p_venta_id uuid,
    p_usuario_id uuid
)
returns public.ventas
language plpgsql
security definer
as $$
declare
    v_negocio_id uuid := public.negocio_actual();
    v_venta public.ventas;
    v_detalle record;
    v_stock_actual integer;
    v_stock_nuevo integer;
begin
    select * into v_venta
    from public.ventas
    where id = p_venta_id and negocio_id = v_negocio_id
    for update;

    if v_venta.id is null then
        raise exception 'Venta no encontrada.';
    end if;

    if v_venta.estado = 'anulada' then
        raise exception 'Esta venta ya estaba anulada.';
    end if;

    for v_detalle in
        select producto_id, cantidad from public.detalle_ventas where venta_id = p_venta_id
    loop
        select stock into v_stock_actual
        from public.productos
        where id = v_detalle.producto_id
        for update;

        v_stock_nuevo := v_stock_actual + v_detalle.cantidad;

        update public.productos
        set stock = v_stock_nuevo, actualizado_en = now()
        where id = v_detalle.producto_id;

        insert into public.movimientos_inventario (
            negocio_id, producto_id, tipo, cantidad, stock_resultante, usuario_id, motivo
        ) values (
            v_negocio_id, v_detalle.producto_id, 'DEVOLUCION', v_detalle.cantidad,
            v_stock_nuevo, p_usuario_id, 'Anulación de venta ' || p_venta_id
        );
    end loop;

    update public.ventas set estado = 'anulada' where id = p_venta_id
    returning * into v_venta;

    return v_venta;
end;
$$;
