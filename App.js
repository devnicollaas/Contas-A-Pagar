import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef, useState } from 'react';
import {
  Alert, FlatList, Pressable, SafeAreaView, StyleSheet, Switch, Text, TextInput, View,
} from 'react-native';
import {
  Banco, createTable, insertConta, selectContasPagina, countContas, updateConta, deleteConta,
} from './Banco/Config';

const POR_PAGINA = 5;
const vazio = { descricao: '', valor: '', vencimento: '', pago: false };

const brl = (v) => 'R$ ' + v.toFixed(2).replace('.', ',');
const dataBR = (iso) => iso.split('-').reverse().join('/');
// Aceita DD/MM/AAAA e devolve AAAA-MM-DD (ordena certo no SQLite), ou null se inválida
function dataISO(br) {
  const m = br.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(+m[3], +m[2] - 1, +m[1]);
  if (d.getDate() !== +m[1] || d.getMonth() !== +m[2] - 1) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export default function App() {
  const db = useRef(null);
  const [contas, setContas] = useState([]);
  const [pagina, setPagina] = useState(1);
  const [total, setTotal] = useState(0);
  const [form, setForm] = useState(vazio);
  const [editId, setEditId] = useState(null);

  const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  async function carregar(p = pagina) {
    const t = await countContas(db.current);
    const ultima = Math.max(1, Math.ceil(t / POR_PAGINA));
    const pg = Math.min(p, ultima); // após excluir o último item da página
    setTotal(t);
    setPagina(pg);
    setContas(await selectContasPagina(db.current, pg, POR_PAGINA));
  }

  useEffect(() => {
    (async () => {
      try {
        db.current = await Banco();
        await createTable(db.current);
        await carregar(1);
      } catch (e) {
        Alert.alert('Erro no banco', String(e));
      }
    })();
  }, []);

  async function salvar() {
    const descricao = form.descricao.trim();
    const valor = parseFloat(form.valor.replace(',', '.'));
    const venc = dataISO(form.vencimento);
    if (!descricao) return Alert.alert('Atenção', 'Informe a descrição.');
    if (!(valor > 0)) return Alert.alert('Atenção', 'Informe um valor maior que zero.');
    if (!venc) return Alert.alert('Atenção', 'Vencimento inválido. Use DD/MM/AAAA.');
    try {
      if (editId) await updateConta(db.current, editId, descricao, valor, venc, form.pago ? 1 : 0);
      else await insertConta(db.current, descricao, valor, venc, form.pago ? 1 : 0);
      cancelar();
      await carregar();
    } catch (e) {
      Alert.alert('Erro ao salvar', String(e));
    }
  }

  function editar(c) {
    setEditId(c.ID_CT);
    setForm({
      descricao: c.DESCRICAO_CT,
      valor: String(c.VALOR_CT).replace('.', ','),
      vencimento: dataBR(c.VENCIMENTO_CT),
      pago: c.PAGO_CT === 1,
    });
  }

  function cancelar() {
    setEditId(null);
    setForm(vazio);
  }

  function excluir(c) {
    Alert.alert('Excluir conta', `Excluir "${c.DESCRICAO_CT}"?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir', style: 'destructive', onPress: async () => {
          await deleteConta(db.current, c.ID_CT);
          if (editId === c.ID_CT) cancelar();
          await carregar();
        },
      },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />
      <Text style={styles.titulo}>Contas a Pagar</Text>

      <View style={styles.card}>
        <Text style={styles.subtitulo}>{editId ? 'Editar conta' : 'Nova conta'}</Text>
        <TextInput style={styles.input} placeholder="Descrição" value={form.descricao}
          onChangeText={(t) => setForm({ ...form, descricao: t })} />
        <View style={styles.linha}>
          <TextInput style={[styles.input, styles.flex]} placeholder="Valor (ex: 120,50)" keyboardType="decimal-pad"
            value={form.valor} onChangeText={(t) => setForm({ ...form, valor: t })} />
          <TextInput style={[styles.input, styles.flex]} placeholder="Vencimento DD/MM/AAAA" keyboardType="numbers-and-punctuation"
            maxLength={10} value={form.vencimento} onChangeText={(t) => setForm({ ...form, vencimento: t })} />
        </View>
        <View style={styles.linha}>
          <Text>Paga?</Text>
          <Switch value={form.pago} onValueChange={(v) => setForm({ ...form, pago: v })} />
          <View style={styles.flex} />
          {editId && <Botao texto="Cancelar" cor="#888" onPress={cancelar} />}
          <Botao texto={editId ? 'Atualizar' : 'Cadastrar'} cor="#2e7d32" onPress={salvar} />
        </View>
      </View>

      <FlatList
        style={styles.flex}
        data={contas}
        keyExtractor={(c) => String(c.ID_CT)}
        ListEmptyComponent={<Text style={styles.vazio}>Nenhuma conta cadastrada.</Text>}
        renderItem={({ item: c }) => (
          <View style={[styles.item, c.PAGO_CT ? styles.itemPago : null]}>
            <View style={styles.flex}>
              <Text style={styles.itemDesc}>{c.DESCRICAO_CT}</Text>
              <Text>{brl(c.VALOR_CT)} · vence {dataBR(c.VENCIMENTO_CT)}</Text>
              <Text style={{ color: c.PAGO_CT ? '#2e7d32' : '#c62828', fontWeight: 'bold' }}>
                {c.PAGO_CT ? 'PAGA' : 'PENDENTE'}
              </Text>
            </View>
            <Botao texto="Editar" cor="#1565c0" onPress={() => editar(c)} />
            <Botao texto="Excluir" cor="#c62828" onPress={() => excluir(c)} />
          </View>
        )}
      />

      <View style={styles.paginacao}>
        <Botao texto="◀ Anterior" cor="#455a64" disabled={pagina <= 1} onPress={() => carregar(pagina - 1)} />
        <Text>Página {pagina} de {totalPaginas} ({total})</Text>
        <Botao texto="Próxima ▶" cor="#455a64" disabled={pagina >= totalPaginas} onPress={() => carregar(pagina + 1)} />
      </View>
    </SafeAreaView>
  );
}

function Botao({ texto, cor, onPress, disabled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
      style={[styles.botao, { backgroundColor: cor, opacity: disabled ? 0.4 : 1 }]}>
      <Text style={styles.botaoTexto}>{texto}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#eceff1', paddingTop: 40 },
  titulo: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', padding: 12, backgroundColor: '#263238', color: '#fff' },
  card: { backgroundColor: '#fff', margin: 10, padding: 10, borderRadius: 8, gap: 8 },
  subtitulo: { fontSize: 16, fontWeight: 'bold' },
  input: { borderWidth: 1, borderColor: '#b0bec5', borderRadius: 6, padding: 8, backgroundColor: '#fafafa' },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  flex: { flex: 1 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', marginHorizontal: 10, marginBottom: 8, padding: 10, borderRadius: 8, borderLeftWidth: 5, borderLeftColor: '#c62828' },
  itemPago: { borderLeftColor: '#2e7d32' },
  itemDesc: { fontSize: 16, fontWeight: 'bold' },
  vazio: { textAlign: 'center', marginTop: 20, color: '#666' },
  botao: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 6 },
  botaoTexto: { color: '#fff', fontWeight: 'bold' },
  paginacao: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 10, backgroundColor: '#fff' },
});
