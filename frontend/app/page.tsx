import Link from "next/link";

const HASURA_ENDPOINT = 'http://10.10.1.208:8080/v1/graphql';
const HASURA_ADMIN_SECRET = 'myadminsecret';

const FETCH_ORDERS_QUERY = `
  query GetVtexOrders($limit: Int!, $offset: Int!) {
    vtex_orders_aggregate {
      aggregate {
        count
      }
    }
    vtex_orders(
      limit: $limit,
      offset: $offset,
      order_by: { createdAt: desc }
    ) {
      creationDate
      orderId
      status
      vtex_rates_benefits {
        name
        vtex_rate_tags {
          value
        }
      }
      vtex_package_attachments {
        type
      }
      vtex_order_items {
        itemId
        commission
      }
      vtex_order_sellers {
        vtex_seller { name }
      }
      vtex_comolatti_order {
        id
        orderId
        filial_faturamento
        filial_faturamento_doc
        pedido
        status
        nome
        cnpj
        retries
        createdAt
        updatedAt
        comolatti_orders_items {
          id
          codigo_interno
          descricao
          quantidade_pedida
          quantidade_atendida
          preco_praticado
        }
        comolatti_orders_invoices {
          id
          icms
          icms_st
          frete
          nota_fiscal
          valor_total
          dt_emissao
          chave_acesso
        }
        comolatti_orders_modais {
          id
          modal
          cnpj
          nome
          entrega
        }
      }
    }
  }
`;

interface PageProps {
  searchParams: Promise<{ page?: string; limit?: string }>;
}

export default async function Home({ searchParams }: PageProps) {
  const resolvedParams = await searchParams;
  const currentPage = Number(resolvedParams.page || 1);
  const pageSize = Number(resolvedParams.limit || 15);
  const offset = (currentPage - 1) * pageSize;

  let orders = [];
  let totalCount = 0;
  let isOffline = false;

  try {
    const res = await fetch(HASURA_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-hasura-admin-secret': HASURA_ADMIN_SECRET,
      },
      body: JSON.stringify({
        query: FETCH_ORDERS_QUERY,
        variables: {
          limit: pageSize,
          offset: offset,
        }
      }),
      cache: 'no-store'
    });

    if (!res.ok) {
      throw new Error(`Erro na requisição Hasura: ${res.statusText}`);
    }

    const json = await res.json();
    if (json.errors) {
      throw new Error(JSON.stringify(json.errors));
    }

    orders = json.data?.vtex_orders || [];
    totalCount = json.data?.vtex_orders_aggregate?.aggregate?.count || 0;
  } catch (err: any) {
    console.warn("⚠️ Não foi possível carregar os dados do Hasura local (banco offline):", err.message);
    orders = [];
    totalCount = 0;
    isOffline = true;
  }

  return (
    <div className="min-h-screen bg-neutral-50 p-6 md:p-12 text-zinc-900 font-sans">
      <div className="max-w-[1600px] mx-auto bg-white rounded-2xl shadow-sm border border-neutral-200/80 p-6 md:p-8">
        
        {/* Header e Indicador de Banco */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-neutral-900">
              Pedidos Financeiro ({totalCount})
            </h1>
            <p className="text-sm text-neutral-500 mt-1">
              Painel de consolidação financeira de vendas integrada VTEX / Comolatti
            </p>
          </div>

          <div className="flex items-center gap-3">
            {isOffline ? (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse" />
                Banco Offline
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Conectado ao Hasura Local (10.10.1.208)
              </span>
            )}
            
            <button className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-neutral-700 bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition cursor-pointer">
              📥 Exportar Excel
            </button>
          </div>
        </div>

        {/* Tabela de Pedidos */}
        <div className="overflow-x-auto rounded-xl border border-neutral-200">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 font-semibold uppercase text-xs tracking-wider">
                <th className="py-4 px-4">Pedido VTEX</th>
                <th className="py-4 px-4">Pedido BR</th>
                <th className="py-4 px-4">Filial</th>
                <th className="py-4 px-4">Seller</th>
                <th className="py-4 px-4">Status BR</th>
                <th className="py-4 px-4">Status VTEX</th>
                <th className="py-4 px-4">NF</th>
                <th className="py-4 px-4">Dt. Emissão</th>
                <th className="py-4 px-4 text-right">Valor Total</th>
                <th className="py-4 px-4 text-right">ICMS</th>
                <th className="py-4 px-4 text-right">ICMS ST</th>
                <th className="py-4 px-4 text-right">Frete</th>
                <th className="py-4 px-4 text-center">Itens</th>
                <th className="py-4 px-4">Campanhas/Cupons</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-200/80">
              {orders.map((order: any, idx: number) => {
                const comolatti = order.vtex_comolatti_order || {};
                const invoice = comolatti.comolatti_orders_invoices?.[0] || {};
                const sellerName = order.vtex_order_sellers?.[0]?.vtex_seller?.name || comolatti.nome || "Não identificado";

                return (
                  <tr key={order.orderId || idx} className="hover:bg-neutral-50/50 transition">
                    <td className="py-4 px-4 font-mono font-medium text-blue-600">
                      {order.orderId}
                    </td>
                    <td className="py-4 px-4 font-mono text-neutral-600">
                      {comolatti.pedido || "—"}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-neutral-800">{comolatti.filial_faturamento || "—"}</div>
                      {comolatti.filial_faturamento_doc && (
                        <div className="text-xs text-neutral-400 mt-0.5">{comolatti.filial_faturamento_doc}</div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-semibold text-neutral-800">{sellerName}</div>
                      {comolatti.cnpj && (
                        <div className="text-xs text-neutral-400 mt-0.5">{comolatti.cnpj}</div>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {comolatti.status ? (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                          comolatti.status === "Faturado" 
                            ? "bg-green-50 text-emerald-700 border border-green-200" 
                            : "bg-neutral-100 text-neutral-700 border border-neutral-200"
                        }`}>
                          {comolatti.status}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {order.status ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200">
                          {order.status}
                        </span>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="py-4 px-4 font-semibold text-neutral-700">
                      {invoice.nota_fiscal || "—"}
                    </td>
                    <td className="py-4 px-4 text-neutral-600 whitespace-nowrap">
                      {invoice.dt_emissao || "—"}
                    </td>
                    <td className="py-4 px-4 text-right font-bold text-neutral-900">
                      {invoice.valor_total ? `R$ ${invoice.valor_total}` : "—"}
                    </td>
                    <td className="py-4 px-4 text-right text-neutral-600">
                      {invoice.icms ? `R$ ${invoice.icms}` : "—"}
                    </td>
                    <td className="py-4 px-4 text-right text-neutral-600">
                      {invoice.icms_st ? `R$ ${invoice.icms_st}` : "—"}
                    </td>
                    <td className="py-4 px-4 text-right text-neutral-600">
                      {invoice.frete ? `R$ ${invoice.frete}` : "—"}
                    </td>
                    <td className="py-4 px-4 text-center font-semibold text-neutral-700">
                      {comolatti.comolatti_orders_items?.length || order.vtex_order_items?.length || 0}
                    </td>
                    <td className="py-4 px-4 max-w-[280px]">
                      <div className="flex flex-col gap-1">
                        {order.vtex_rates_benefits && order.vtex_rates_benefits.length > 0 ? (
                          order.vtex_rates_benefits.map((benefit: any, bIdx: number) => {
                            const val = benefit.vtex_rate_tags?.[0]?.value;
                            return (
                              <div key={bIdx} className="text-xs text-neutral-600 bg-neutral-50 border border-neutral-150 px-2 py-1 rounded-lg">
                                <span className="font-semibold text-neutral-800">{benefit.name}</span>
                                {val && <span className="text-neutral-500 ml-1">({val})</span>}
                              </div>
                            );
                          })
                        ) : (
                          <span className="text-neutral-400 text-xs">Sem cupons</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Paginação */}
        <div className="flex items-center justify-between border-t border-neutral-200 mt-6 pt-6">
          <p className="text-sm text-neutral-500">
            Mostrando página <span className="font-semibold text-neutral-800">{currentPage}</span>
          </p>
          
          <div className="flex items-center gap-2">
            <Link
              href={`/?page=${Math.max(1, currentPage - 1)}&limit=${pageSize}`}
              className={`inline-flex items-center justify-center px-4 py-2 text-sm font-semibold border rounded-lg transition ${
                currentPage <= 1 
                  ? "border-neutral-100 text-neutral-300 pointer-events-none" 
                  : "border-neutral-200 text-neutral-700 hover:bg-neutral-50 cursor-pointer"
              }`}
            >
              Anterior
            </Link>
            <Link
              href={`/?page=${currentPage + 1}&limit=${pageSize}`}
              className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold border border-neutral-200 text-neutral-700 bg-white rounded-lg hover:bg-neutral-50 transition cursor-pointer"
            >
              Próxima
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
}
