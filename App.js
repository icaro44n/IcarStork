app.js
import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, addDoc, getDocs, doc, onSnapshot, updateDoc, deleteDoc, query, where, serverTimestamp } from 'firebase/firestore';

// Contexto para compartilhar o estado do Firebase e do usuário
const FirebaseContext = createContext(null);

// Componente do provedor Firebase
function FirebaseProvider({ children }) {
  const [app, setApp] = useState(null);
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loadingFirebase, setLoadingFirebase] = useState(true);
  const [firebaseError, setFirebaseError] = useState(null);
  const [currentAppIdForFirestorePath, setCurrentAppIdForFirestorePath] = useState(null);

  useEffect(() => {
    const initializeFirebase = async () => {
      try {
        // Configuração do Firebase para uma aplicação web.
        // As variáveis de ambiente (REACT_APP_FIREBASE_...) devem ser definidas
        // em um arquivo .env na raiz do seu projeto React.
        const firebaseConfig = {
          apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
          authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
          storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.REACT_APP_FIREBASE_APP_ID, // Este é o ID do aplicativo web do Firebase
          measurementId: process.env.REACT_APP_FIREBASE_MEASUREMENT_ID,
        };

        // Verifica se a configuração do Firebase está completa
        if (!firebaseConfig.apiKey || !firebaseConfig.projectId || !firebaseConfig.appId) {
          console.error("Firebase config is incomplete. Please ensure all REACT_APP_FIREBASE_ variables are defined in your .env file.");
          setFirebaseError("Configuração do Firebase incompleta. Verifique seu arquivo .env.");
          setLoadingFirebase(false);
          return;
        }

        const firebaseApp = initializeApp(firebaseConfig);
        const firestoreDb = getFirestore(firebaseApp);
        const firebaseAuth = getAuth(firebaseApp);

        setApp(firebaseApp);
        setDb(firestoreDb);
        setAuth(firebaseAuth);
        setCurrentAppIdForFirestorePath(firebaseConfig.appId); // Define o ID do app para uso nos caminhos do Firestore

        // Observa mudanças no estado de autenticação
        const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
          if (user) {
            setUserId(user.uid);
            console.log("Usuário autenticado:", user.uid);
          } else {
            setUserId(null);
            console.log("Nenhum usuário autenticado.");
          }
          setLoadingFirebase(false);
        });

        return () => unsubscribe(); // Limpa o listener na desmontagem
      } catch (error) {
        console.error("Erro ao inicializar Firebase:", error);
        setFirebaseError(`Erro ao inicializar Firebase: ${error.message}`);
        setLoadingFirebase(false);
      }
    };

    initializeFirebase();
  }, []); // Executa apenas uma vez na montagem

  return (
    <FirebaseContext.Provider value={{ app, db, auth, userId, loadingFirebase, firebaseError, currentAppIdForFirestorePath }}>
      {children}
    </FirebaseContext.Provider>
  );
}

// Hook personalizado para usar o contexto Firebase
function useFirebase() {
  return useContext(FirebaseContext);
}

// Componente Modal para feedback ao usuário
function Modal({ message, onClose, type = 'info' }) {
  let bgColor = 'bg-blue-500';
  let textColor = 'text-white';

  if (type === 'error') {
    bgColor = 'bg-red-500';
  } else if (type === 'success') {
    bgColor = 'bg-green-500';
  }

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className={`rounded-lg shadow-xl p-6 max-w-sm w-full ${bgColor} ${textColor} text-center`}>
        <p className="text-lg font-semibold mb-4">{message}</p>
        <button
          onClick={onClose}
          className="mt-4 px-6 py-2 bg-white text-gray-800 rounded-md shadow hover:bg-gray-100 transition-colors duration-200"
        >
          Fechar
        </button>
      </div>
    </div>
  );
}

// Componente de carregamento
function LoadingSpinner() {
  return (
    <div className="flex justify-center items-center py-8">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>
  );
}

// Componente para exibir o ID do usuário
function UserInfoDisplay({ userId, onLogout }) {
  return (
    <div className="p-4 bg-gray-100 rounded-lg shadow-inner text-sm text-gray-700 break-words flex justify-between items-center">
      <div>
        <p className="font-semibold">ID do Usuário (para demonstração):</p>
        <p className="text-gray-600">{userId || "Carregando..."}</p>
      </div>
      {userId && (
        <button
          onClick={onLogout}
          className="ml-4 px-4 py-2 bg-red-500 text-white rounded-md shadow hover:bg-red-600 transition-colors duration-200"
        >
          Sair
        </button>
      )}
    </div>
  );
}

// Componente de Login
function Login({ onLoginSuccess, onSwitchToRegister, showModal }) {
  const { auth } = useFirebase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
      showModal("Login bem-sucedido!", 'success');
      onLoginSuccess();
    } catch (err) {
      console.error("Erro no login:", err);
      let errorMessage = "Erro ao fazer login. Verifique seu e-mail e senha.";
      if (err.code === 'auth/user-not-found') {
        errorMessage = "Usuário não encontrado. Crie uma conta.";
      } else if (err.code === 'auth/wrong-password') {
        errorMessage = "Senha incorreta.";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "E-mail inválido.";
      }
      showModal(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Login IcarStok</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label htmlFor="loginEmail" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="loginEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
            />
          </div>
          <div>
            <label htmlFor="loginPassword" className="block text-sm font-medium text-gray-700">Senha</label>
            <input
              type="password"
              id="loginPassword"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 px-4 bg-indigo-600 text-white rounded-md shadow-md hover:bg-indigo-700 transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            disabled={loading}
          >
            {loading ? <LoadingSpinner /> : 'Entrar'}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-600">
          Não tem uma conta?{' '}
          <button
            onClick={onSwitchToRegister}
            className="text-indigo-600 hover:text-indigo-800 font-semibold focus:outline-none"
          >
            Cadastre-se
          </button>
        </p>
      </div>
    </div>
  );
}

// Componente de Registro
function Register({ onRegisterSuccess, onSwitchToLogin, showModal }) {
  const { auth } = useFirebase();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e) => {
    e.preventDefault();
    setLoading(true);
    if (password !== confirmPassword) {
      showModal("As senhas não coincidem.", 'error');
      setLoading(false);
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      showModal("Cadastro bem-sucedido! Faça login.", 'success');
      onRegisterSuccess();
    } catch (err) {
      console.error("Erro no registro:", err);
      let errorMessage = "Erro ao cadastrar. Tente novamente.";
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = "Este e-mail já está em uso.";
      } else if (err.code === 'auth/weak-password') {
        errorMessage = "A senha é muito fraca (mínimo 6 caracteres).";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "E-mail inválido.";
      }
      showModal(errorMessage, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100 p-4">
      <div className="bg-white p-8 rounded-lg shadow-xl w-full max-w-md">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 text-center">Cadastro IcarStok</h2>
        <form onSubmit={handleRegister} className="space-y-4">
          <div>
            <label htmlFor="registerEmail" className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              id="registerEmail"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
            />
          </div>
          <div>
            <label htmlFor="registerPassword" className="block text-sm font-medium text-gray-700">Senha</label>
            <input
              type="password"
              id="registerPassword"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">Confirmar Senha</label>
            <input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 px-4 bg-green-600 text-white rounded-md shadow-md hover:bg-green-700 transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
            disabled={loading}
          >
            {loading ? <LoadingSpinner /> : 'Cadastrar'}
          </button>
        </form>
        <p className="mt-6 text-center text-gray-600">
          Já tem uma conta?{' '}
          <button
            onClick={onSwitchToLogin}
            className="text-indigo-600 hover:text-indigo-800 font-semibold focus:outline-none"
          >
            Faça Login
          </button>
        </p>
      </div>
    </div>
  );
}


// Componente principal da aplicação
function App() {
  const { db, auth, userId, loadingFirebase, firebaseError, currentAppIdForFirestorePath } = useFirebase();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [loadingData, setLoadingData] = useState(true);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiPredictions, setAiPredictions] = useState(null);
  const [modal, setModal] = useState(null); // { message: '', type: '' }
  const [showAuthForm, setShowAuthForm] = useState('login'); // 'login' or 'register'

  // Função para mostrar um modal
  const showModal = (message, type = 'info') => {
    setModal({ message, type });
  };

  // Função para fechar o modal
  const closeModal = () => {
    setModal(null);
  };

  // Função para fazer logout
  const handleLogout = async () => {
    if (auth) {
      try {
        await signOut(auth);
        showModal("Logout realizado com sucesso!", 'success');
        // Redireciona para a tela de login após o logout
        setShowAuthForm('login');
      } catch (error) {
        console.error("Erro ao fazer logout:", error);
        showModal(`Erro ao fazer logout: ${error.message}`, 'error');
      }
    }
  };

  // Efeito para carregar dados do Firestore em tempo real
  useEffect(() => {
    // Só carrega dados se o Firebase estiver pronto e o userId estiver disponível (usuário logado)
    if (!db || !userId || !currentAppIdForFirestorePath) {
      // Limpa os dados se o usuário não estiver logado ou o Firebase não estiver totalmente pronto
      setProducts([]);
      setSuppliers([]);
      setSales([]);
      setPurchases([]);
      setLoadingData(false);
      return;
    }

    setLoadingData(true);
    const appId = currentAppIdForFirestorePath; // Usa o ID do app obtido da configuração do Firebase

    // Listener para produtos
    const productsRef = collection(db, `artifacts/${appId}/users/${userId}/products`);
    const unsubscribeProducts = onSnapshot(productsRef, (snapshot) => {
      const productsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setProducts(productsData);
      setLoadingData(false);
    }, (error) => {
      console.error("Erro ao carregar produtos:", error);
      showModal(`Erro ao carregar produtos: ${error.message}`, 'error');
      setLoadingData(false);
    });

    // Listener para fornecedores
    const suppliersRef = collection(db, `artifacts/${appId}/users/${userId}/suppliers`);
    const unsubscribeSuppliers = onSnapshot(suppliersRef, (snapshot) => {
      const suppliersData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSuppliers(suppliersData);
    }, (error) => {
      console.error("Erro ao carregar fornecedores:", error);
      showModal(`Erro ao carregar fornecedores: ${error.message}`, 'error');
    });

    // Listener para vendas
    const salesRef = collection(db, `artifacts/${appId}/users/${userId}/sales`);
    const unsubscribeSales = onSnapshot(salesRef, (snapshot) => {
      const salesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSales(salesData);
    }, (error) => {
      console.error("Erro ao carregar vendas:", error);
      showModal(`Erro ao carregar vendas: ${error.message}`, 'error');
    });

    // Listener para compras
    const purchasesRef = collection(db, `artifacts/${appId}/users/${userId}/purchases`);
    const unsubscribePurchases = onSnapshot(purchasesRef, (snapshot) => {
      const purchasesData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPurchases(purchasesData);
    }, (error) => {
      console.error("Erro ao carregar compras:", error);
      showModal(`Erro ao carregar compras: ${e.message}`, 'error');
    });

    // Limpa os listeners na desmontagem do componente
    return () => {
      unsubscribeProducts();
      unsubscribeSuppliers();
      unsubscribeSales();
      unsubscribePurchases();
    };
  }, [db, userId, currentAppIdForFirestorePath]); // Dependências: db, userId e currentAppIdForFirestorePath

  // --- Funções CRUD (Exemplos para Produtos) ---
  const addProduct = async (productData) => {
    if (!db || !userId || !currentAppIdForFirestorePath) {
      showModal("Firebase não inicializado ou usuário não autenticado.", 'error');
      return;
    }
    const appId = currentAppIdForFirestorePath;
    try {
      await addDoc(collection(db, `artifacts/${appId}/users/${userId}/products`), {
        ...productData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      showModal("Produto adicionado com sucesso!", 'success');
    } catch (e) {
      console.error("Erro ao adicionar produto: ", e);
      showModal(`Erro ao adicionar produto: ${e.message}`, 'error');
    }
  };

  const updateProduct = async (id, productData) => {
    if (!db || !userId || !currentAppIdForFirestorePath) {
      showModal("Firebase não inicializado ou usuário não autenticado.", 'error');
      return;
    }
    const appId = currentAppIdForFirestorePath;
    try {
      const productRef = doc(db, `artifacts/${appId}/users/${userId}/products`, id);
      await updateDoc(productRef, {
        ...productData,
        updatedAt: serverTimestamp(),
      });
      showModal("Produto atualizado com sucesso!", 'success');
    } catch (e) {
      console.error("Erro ao atualizar produto: ", e);
      showModal(`Erro ao atualizar produto: ${e.message}`, 'error');
    }
  };

  const deleteProduct = async (id) => {
    if (!db || !userId || !currentAppIdForFirestorePath) {
      showModal("Firebase não inicializado ou usuário não autenticado.", 'error');
      return;
    }
    const appId = currentAppIdForFirestorePath;
    try {
      await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/products`, id));
      showModal("Produto removido com sucesso!", 'success');
    } catch (e) {
      console.error("Erro ao remover produto: ", e);
      showModal(`Erro ao remover produto: ${e.message}`, 'error');
    }
  };

  // --- Funções de IA (Placeholders) ---
  const callGeminiAPI = async (prompt, schema = null) => {
    setLoadingAI(true);
    try {
      let chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });

      const payload = { contents: chatHistory };
      if (schema) {
        payload.generationConfig = {
          responseMimeType: "application/json",
          responseSchema: schema
        };
      }

      // IMPORTANTE: Para uso em produção, considere usar um proxy seguro
      // para a API do Gemini, para não expor sua chave de API diretamente no frontend.
      const apiKey = process.env.REACT_APP_GEMINI_API_KEY || ""; // Use sua chave de API do Gemini aqui
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const text = result.candidates[0].content.parts[0].text;
        if (schema) {
          try {
            return JSON.parse(text);
          } catch (jsonError) {
            console.error("Erro ao parsear JSON da API Gemini:", jsonError);
            showModal("Erro ao processar resposta da IA.", 'error');
            return null;
          }
        }
        return text;
      } else {
        console.error("Resposta inesperada da API Gemini:", result);
        showModal("Resposta inesperada da IA.", 'error');
        return null;
      }
    } catch (error) {
      console.error("Erro ao chamar a API Gemini:", error);
      showModal(`Erro ao chamar a IA: ${error.message}`, 'error');
      return null;
    } finally {
      setLoadingAI(false);
    }
  };

  const predictDemand = async () => {
    // Exemplo de prompt para a IA
    const salesData = sales.map(s => ({ productId: s.productId, quantity: s.quantity, date: s.saleDate?.toDate ? s.saleDate.toDate().toISOString().split('T')[0] : s.saleDate }));
    const prompt = `Com base nos seguintes dados de vendas históricas: ${JSON.stringify(salesData)}, preveja a demanda futura para cada produto nos próximos 3 meses. Forneça a previsão em um formato JSON como: [{"productId": "id_do_produto", "month": "YYYY-MM", "predictedQuantity": 123}].`;

    const schema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          productId: { type: "STRING" },
          month: { type: "STRING" },
          predictedQuantity: { type: "NUMBER" }
        },
        propertyOrdering: ["productId", "month", "predictedQuantity"]
      }
    };

    const prediction = await callGeminiAPI(prompt, schema);
    if (prediction) {
      setAiPredictions({ type: 'demand', data: prediction });
      showModal("Previsão de demanda gerada!", 'success');
    } else {
      showModal("Não foi possível gerar a previsão de demanda.", 'error');
    }
  };

  const optimizeReplenishment = async () => {
    // Exemplo de prompt para a IA
    const currentStock = products.map(p => ({ productId: p.id, currentStock: p.currentStock, minStock: p.minStock, supplierId: p.supplierId }));
    const prompt = `Com base no estoque atual: ${JSON.stringify(currentStock)} e nas previsões de demanda (se houver, use as últimas geradas ou considere uma demanda média), sugira pedidos de reabastecimento para cada produto, incluindo a quantidade e o fornecedor. Forneça em um formato JSON como: [{"productId": "id_do_produto", "quantityToOrder": 50, "supplierId": "id_do_fornecedor"}].`;

    const schema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          productId: { type: "STRING" },
          quantityToOrder: { type: "NUMBER" },
          supplierId: { type: "STRING" }
        },
        propertyOrdering: ["productId", "quantityToOrder", "supplierId"]
      }
    };

    const replenishment = await callGeminiAPI(prompt, schema);
    if (replenishment) {
      setAiPredictions({ type: 'replenishment', data: replenishment });
      showModal("Sugestões de reabastecimento geradas!", 'success');
    } else {
      showModal("Não foi possível gerar sugestões de reabastecimento.", 'error');
    }
  };

  const detectAnomalies = async () => {
    // Exemplo de prompt para a IA
    const allMovements = [
      ...sales.map(s => ({ type: 'sale', productId: s.productId, quantity: s.quantity, date: s.saleDate?.toDate ? s.saleDate.toDate().toISOString().split('T')[0] : s.saleDate })),
      ...purchases.map(p => ({ type: 'purchase', productId: p.productId, quantity: p.quantity, date: p.purchaseDate?.toDate ? p.purchaseDate.toDate().toISOString().split('T')[0] : p.purchaseDate })),
    ];
    const prompt = `Analise os seguintes movimentos de estoque: ${JSON.stringify(allMovements)}. Identifique quaisquer anomalias (picos incomuns, quedas inesperadas, etc.) e explique o que elas podem indicar. Forneça em um formato JSON como: [{"type": "anomaly", "description": "descrição da anomalia", "productId": "id_do_produto_afetado", "date": "data_da_anomalia"}].`;

    const schema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          type: { type: "STRING" },
          description: { type: "STRING" },
          productId: { type: "STRING" },
          date: { type: "STRING" }
        },
        propertyOrdering: ["type", "description", "productId", "date"]
      }
    };

    const anomalies = await callGeminiAPI(prompt, schema);
    if (anomalies) {
      setAiPredictions({ type: 'anomalies', data: anomalies });
      showModal("Anomalias detectadas!", 'success');
    } else {
      showModal("Não foi possível detectar anomalias.", 'error');
    }
  };

  const analyzeProductPerformance = async () => {
    // Exemplo de prompt para a IA
    const productSales = products.map(p => {
      const totalSold = sales.filter(s => s.productId === p.id).reduce((sum, s) => sum + s.quantity, 0);
      return { productId: p.id, name: p.name, totalSold, currentStock: p.currentStock };
    });
    const prompt = `Analise o desempenho dos seguintes produtos com base nas vendas: ${JSON.stringify(productSales)}. Identifique os produtos mais vendidos, os menos vendidos e sugira ações para melhorar o desempenho. Forneça em um formato JSON como: [{"productId": "id_do_produto", "performance": "bom/ruim/médio", "recommendation": "sugestão de ação"}].`;

    const schema = {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          productId: { type: "STRING" },
          performance: { type: "STRING" },
          recommendation: { type: "STRING" }
        },
        propertyOrdering: ["productId", "performance", "recommendation"]
      }
    };

    const performance = await callGeminiAPI(prompt, schema);
    if (performance) {
      setAiPredictions({ type: 'performance', data: performance });
      showModal("Análise de desempenho de produtos gerada!", 'success');
    } else {
      showModal("Não foi possível analisar o desempenho dos produtos.", 'error');
    }
  };

  // --- Componentes de UI para cada aba ---

  const Dashboard = () => {
    // KPIs de exemplo
    const totalStockValue = products.reduce((sum, p) => sum + (p.currentStock * p.costPrice), 0);
    const lowStockProducts = products.filter(p => p.currentStock <= p.minStock);
    const totalSalesValue = sales.reduce((sum, s) => sum + (s.quantity * s.salePrice), 0);

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Dashboard</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <div className="bg-blue-100 p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-blue-800">Valor Total do Estoque</h3>
            <p className="text-3xl font-bold text-blue-900">R$ {totalStockValue.toFixed(2)}</p>
          </div>
          <div className="bg-yellow-100 p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-yellow-800">Produtos com Estoque Baixo</h3>
            <p className="text-3xl font-bold text-yellow-900">{lowStockProducts.length}</p>
          </div>
          <div className="bg-green-100 p-4 rounded-lg shadow-sm">
            <h3 className="text-lg font-semibold text-green-800">Valor Total de Vendas</h3>
            <p className="text-3xl font-bold text-green-900">R$ {totalSalesValue.toFixed(2)}</p>
          </div>
        </div>

        <h3 className="text-xl font-semibold text-gray-800 mb-4">Ações de IA</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <button
            onClick={predictDemand}
            className="bg-purple-600 text-white py-3 px-6 rounded-md shadow-md hover:bg-purple-700 transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-opacity-75"
            disabled={loadingAI}
          >
            {loadingAI ? <LoadingSpinner /> : 'Prever Demanda'}
          </button>
          <button
            onClick={optimizeReplenishment}
            className="bg-teal-600 text-white py-3 px-6 rounded-md shadow-md hover:bg-teal-700 transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-opacity-75"
            disabled={loadingAI}
          >
            {loadingAI ? <LoadingSpinner /> : 'Otimizar Reabastecimento'}
          </button>
          <button
            onClick={detectAnomalies}
            className="bg-red-600 text-white py-3 px-6 rounded-md shadow-md hover:bg-red-700 transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-opacity-75"
            disabled={loadingAI}
          >
            {loadingAI ? <LoadingSpinner /> : 'Detectar Anomalias'}
          </button>
          <button
            onClick={analyzeProductPerformance}
            className="bg-indigo-600 text-white py-3 px-6 rounded-md shadow-md hover:bg-indigo-700 transition duration-300 ease-in-out transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-75"
            disabled={loadingAI}
          >
            {loadingAI ? <LoadingSpinner /> : 'Analisar Desempenho de Produtos'}
          </button>
        </div>

        {aiPredictions && (
          <div className="mt-8 p-6 bg-gray-50 rounded-lg shadow-inner">
            <h3 className="text-xl font-semibold text-gray-800 mb-4">Resultados da IA: {aiPredictions.type === 'demand' ? 'Previsão de Demanda' : aiPredictions.type === 'replenishment' ? 'Sugestões de Reabastecimento' : aiPredictions.type === 'anomalies' ? 'Anomalias Detectadas' : 'Análise de Desempenho'}</h3>
            <pre className="bg-gray-100 p-4 rounded-md text-sm overflow-auto max-h-60">
              {JSON.stringify(aiPredictions.data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const ProductsManagement = () => {
    const [editingProduct, setEditingProduct] = useState(null);
    const [productForm, setProductForm] = useState({
      name: '', description: '', sku: '', category: '', costPrice: 0, salePrice: 0, currentStock: 0, minStock: 0, supplierId: ''
    });

    const handleFormChange = (e) => {
      const { name, value, type } = e.target;
      setProductForm(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) : value
      }));
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (editingProduct) {
        await updateProduct(editingProduct.id, productForm);
        setEditingProduct(null);
      } else {
        await addProduct(productForm);
      }
      setProductForm({ name: '', description: '', sku: '', category: '', costPrice: 0, salePrice: 0, currentStock: 0, minStock: 0, supplierId: '' });
    };

    const handleEditClick = (product) => {
      setEditingProduct(product);
      setProductForm(product);
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Gestão de Produtos</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
          <div className="col-span-full">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">{editingProduct ? 'Editar Produto' : 'Adicionar Novo Produto'}</h3>
          </div>
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">Nome</label>
            <input type="text" id="name" name="name" value={productForm.name} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">Descrição</label>
            <input type="text" id="description" name="description" value={productForm.description} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="sku" className="block text-sm font-medium text-gray-700">SKU</label>
            <input type="text" id="sku" name="sku" value={productForm.sku} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">Categoria</label>
            <input type="text" id="category" name="category" value={productForm.category} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="costPrice" className="block text-sm font-medium text-gray-700">Preço de Custo</label>
            <input type="number" id="costPrice" name="costPrice" value={productForm.costPrice} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700">Preço de Venda</label>
            <input type="number" id="salePrice" name="salePrice" value={productForm.salePrice} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="currentStock" className="block text-sm font-medium text-gray-700">Estoque Atual</label>
            <input type="number" id="currentStock" name="currentStock" value={productForm.currentStock} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="minStock" className="block text-sm font-medium text-gray-700">Estoque Mínimo</label>
            <input type="number" id="minStock" name="minStock" value={productForm.minStock} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="supplierId" className="block text-sm font-medium text-gray-700">Fornecedor</label>
            <select id="supplierId" name="supplierId" value={productForm.supplierId} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2">
              <option value="">Selecione um fornecedor</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div className="col-span-full flex justify-end space-x-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              {editingProduct ? 'Atualizar Produto' : 'Adicionar Produto'}
            </button>
            {editingProduct && (
              <button type="button" onClick={() => { setEditingProduct(null); setProductForm({ name: '', description: '', sku: '', category: '', costPrice: 0, salePrice: 0, currentStock: 0, minStock: 0, supplierId: '' }); }} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md shadow-sm hover:bg-gray-400">
                Cancelar
              </button>
            )}
          </div>
        </form>

        <h3 className="text-xl font-semibold text-gray-800 mb-4">Lista de Produtos</h3>
        {products.length === 0 ? (
          <p className="text-gray-600">Nenhum produto cadastrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">SKU</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque Atual</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estoque Mínimo</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Venda</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fornecedor</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {products.map((product) => (
                  <tr key={product.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.sku}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.currentStock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{product.minStock}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ {product.salePrice.toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {suppliers.find(s => s.id === product.supplierId)?.name || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleEditClick(product)} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar</button>
                      <button onClick={() => deleteProduct(product.id)} className="text-red-600 hover:text-red-900">Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const SuppliersManagement = () => {
    const [editingSupplier, setEditingSupplier] = useState(null);
    const [supplierForm, setSupplierForm] = useState({
      name: '', contact: '', address: '', paymentTerms: ''
    });

    const handleFormChange = (e) => {
      const { name, value } = e.target;
      setSupplierForm(prev => ({
        ...prev,
        [name]: value
      }));
    };

    const handleSubmit = async (e) => {
      e.preventDefault();
      if (!db || !userId || !currentAppIdForFirestorePath) {
        showModal("Firebase não inicializado ou usuário não autenticado.", 'error');
        return;
      }
      const appId = currentAppIdForFirestorePath;
      try {
        if (editingSupplier) {
          await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/suppliers`, editingSupplier.id), {
            ...supplierForm,
            updatedAt: serverTimestamp(),
          });
          showModal("Fornecedor atualizado com sucesso!", 'success');
          setEditingSupplier(null);
        } else {
          await addDoc(collection(db, `artifacts/${appId}/users/${userId}/suppliers`), {
            ...supplierForm,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          showModal("Fornecedor adicionado com sucesso!", 'success');
        }
        setSupplierForm({ name: '', contact: '', address: '', paymentTerms: '' });
      } catch (e) {
        console.error("Erro ao salvar fornecedor: ", e);
        showModal(`Erro ao salvar fornecedor: ${e.message}`, 'error');
      }
    };

    const handleEditClick = (supplier) => {
      setEditingSupplier(supplier);
      setSupplierForm(supplier);
    };

    const handleDelete = async (id) => {
      if (!db || !userId || !currentAppIdForFirestorePath) {
        showModal("Firebase não inicializado ou usuário não autenticado.", 'error');
        return;
      }
      const appId = currentAppIdForFirestorePath;
      try {
        await deleteDoc(doc(db, `artifacts/${appId}/users/${userId}/suppliers`, id));
        showModal("Fornecedor removido com sucesso!", 'success');
      } catch (e) {
        console.error("Erro ao remover fornecedor: ", e);
        showModal(`Erro ao remover fornecedor: ${e.message}`, 'error');
      }
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Gestão de Fornecedores</h2>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
          <div className="col-span-full">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">{editingSupplier ? 'Editar Fornecedor' : 'Adicionar Novo Fornecedor'}</h3>
          </div>
          <div>
            <label htmlFor="supplierName" className="block text-sm font-medium text-gray-700">Nome</label>
            <input type="text" id="supplierName" name="name" value={supplierForm.name} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="contact" className="block text-sm font-medium text-gray-700">Contato</label>
            <input type="text" id="contact" name="contact" value={supplierForm.contact} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">Endereço</label>
            <input type="text" id="address" name="address" value={supplierForm.address} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="paymentTerms" className="block text-sm font-medium text-gray-700">Termos de Pagamento</label>
            <input type="text" id="paymentTerms" name="paymentTerms" value={supplierForm.paymentTerms} onChange={handleFormChange} className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div className="col-span-full flex justify-end space-x-2">
            <button type="submit" className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2">
              {editingSupplier ? 'Atualizar Fornecedor' : 'Adicionar Fornecedor'}
            </button>
            {editingSupplier && (
              <button type="button" onClick={() => { setEditingSupplier(null); setSupplierForm({ name: '', contact: '', address: '', paymentTerms: '' }); }} className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md shadow-sm hover:bg-gray-400">
                Cancelar
              </button>
            )}
          </div>
        </form>

        <h3 className="text-xl font-semibold text-gray-800 mb-4">Lista de Fornecedores</h3>
        {suppliers.length === 0 ? (
          <p className="text-gray-600">Nenhum fornecedor cadastrado.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Nome</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Contato</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Endereço</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ações</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {suppliers.map((supplier) => (
                  <tr key={supplier.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{supplier.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.contact}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier.address}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button onClick={() => handleEditClick(supplier)} className="text-indigo-600 hover:text-indigo-900 mr-4">Editar</button>
                      <button onClick={() => handleDelete(supplier.id)} className="text-red-600 hover:text-red-900">Remover</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const SalesManagement = () => {
    const [saleForm, setSaleForm] = useState({ productId: '', quantity: 0, salePrice: 0, saleDate: '' });

    const handleFormChange = (e) => {
      const { name, value, type } = e.target;
      setSaleForm(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) : value
      }));
    };

    const handleAddSale = async (e) => {
      e.preventDefault();
      if (!db || !userId || !currentAppIdForFirestorePath) {
        showModal("Firebase não inicializado ou usuário não autenticado.", 'error');
        return;
      }
      const appId = currentAppIdForFirestorePath;
      try {
        const product = products.find(p => p.id === saleForm.productId);
        if (!product || product.currentStock < saleForm.quantity) {
          showModal("Estoque insuficiente ou produto não encontrado.", 'error');
          return;
        }

        // Adiciona a venda
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/sales`), {
          ...saleForm,
          saleDate: new Date(saleForm.saleDate), // Converte para Timestamp do Firestore
          createdAt: serverTimestamp(),
        });

        // Atualiza o estoque do produto
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/products`, saleForm.productId), {
          currentStock: product.currentStock - saleForm.quantity,
          updatedAt: serverTimestamp(),
        });

        showModal("Venda registrada com sucesso e estoque atualizado!", 'success');
        setSaleForm({ productId: '', quantity: 0, salePrice: 0, saleDate: '' });
      } catch (e) {
        console.error("Erro ao registrar venda: ", e);
        showModal(`Erro ao registrar venda: ${e.message}`, 'error');
      }
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Gestão de Vendas</h2>

        <form onSubmit={handleAddSale} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
          <div className="col-span-full">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Registrar Nova Venda</h3>
          </div>
          <div>
            <label htmlFor="saleProductId" className="block text-sm font-medium text-gray-700">Produto</label>
            <select id="saleProductId" name="productId" value={saleForm.productId} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2">
              <option value="">Selecione um produto</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name} (Estoque: {p.currentStock})</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="saleQuantity" className="block text-sm font-medium text-gray-700">Quantidade</label>
            <input type="number" id="saleQuantity" name="quantity" value={saleForm.quantity} onChange={handleFormChange} required min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="salePrice" className="block text-sm font-medium text-gray-700">Preço de Venda (por unidade)</label>
            <input type="number" id="salePrice" name="salePrice" value={saleForm.salePrice} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="saleDate" className="block text-sm font-medium text-gray-700">Data da Venda</label>
            <input type="date" id="saleDate" name="saleDate" value={saleForm.saleDate} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div className="col-span-full flex justify-end">
            <button type="submit" className="px-4 py-2 bg-green-600 text-white rounded-md shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
              Registrar Venda
            </button>
          </div>
        </form>

        <h3 className="text-xl font-semibold text-gray-800 mb-4">Histórico de Vendas</h3>
        {sales.length === 0 ? (
          <p className="text-gray-600">Nenhuma venda registrada.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Total</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sales.map((sale) => {
                  const product = products.find(p => p.id === sale.productId);
                  const saleDate = sale.saleDate?.toDate ? sale.saleDate.toDate().toLocaleDateString() : sale.saleDate;
                  return (
                    <tr key={sale.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product?.name || 'Produto Desconhecido'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sale.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ {(sale.quantity * sale.salePrice).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{saleDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  const PurchasesManagement = () => {
    const [purchaseForm, setPurchaseForm] = useState({ productId: '', quantity: 0, costPrice: 0, purchaseDate: '', supplierId: '' });

    const handleFormChange = (e) => {
      const { name, value, type } = e.target;
      setPurchaseForm(prev => ({
        ...prev,
        [name]: type === 'number' ? parseFloat(value) : value
      }));
    };

    const handleAddPurchase = async (e) => {
      e.preventDefault();
      if (!db || !userId || !currentAppIdForFirestorePath) {
        showModal("Firebase não inicializado ou usuário não autenticado.", 'error');
        return;
      }
      const appId = currentAppIdForFirestorePath;
      try {
        const product = products.find(p => p.id === purchaseForm.productId);
        if (!product) {
          showModal("Produto não encontrado.", 'error');
          return;
        }

        // Adiciona a compra
        await addDoc(collection(db, `artifacts/${appId}/users/${userId}/purchases`), {
          ...purchaseForm,
          purchaseDate: new Date(purchaseForm.purchaseDate), // Converte para Timestamp do Firestore
          createdAt: serverTimestamp(),
        });

        // Atualiza o estoque do produto
        await updateDoc(doc(db, `artifacts/${appId}/users/${userId}/products`, purchaseForm.productId), {
          currentStock: product.currentStock + purchaseForm.quantity,
          updatedAt: serverTimestamp(),
        });

        showModal("Compra registrada com sucesso e estoque atualizado!", 'success');
        setPurchaseForm({ productId: '', quantity: 0, costPrice: 0, purchaseDate: '', supplierId: '' });
      } catch (e) {
        console.error("Erro ao registrar compra: ", e);
        showModal(`Erro ao registrar compra: ${e.message}`, 'error');
      }
    };

    return (
      <div className="p-6 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-gray-800 mb-6">Gestão de Compras</h2>

        <form onSubmit={handleAddPurchase} className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8 p-4 bg-gray-50 rounded-lg shadow-inner">
          <div className="col-span-full">
            <h3 className="text-xl font-semibold text-gray-700 mb-4">Registrar Nova Compra</h3>
          </div>
          <div>
            <label htmlFor="purchaseProductId" className="block text-sm font-medium text-gray-700">Produto</label>
            <select id="purchaseProductId" name="productId" value={purchaseForm.productId} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2">
              <option value="">Selecione um produto</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="purchaseSupplierId" className="block text-sm font-medium text-gray-700">Fornecedor</label>
            <select id="purchaseSupplierId" name="supplierId" value={purchaseForm.supplierId} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2">
              <option value="">Selecione um fornecedor</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="purchaseQuantity" className="block text-sm font-medium text-gray-700">Quantidade</label>
            <input type="number" id="purchaseQuantity" name="quantity" value={purchaseForm.quantity} onChange={handleFormChange} required min="1" className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="purchaseCostPrice" className="block text-sm font-medium text-gray-700">Preço de Custo (por unidade)</label>
            <input type="number" id="purchaseCostPrice" name="costPrice" value={purchaseForm.costPrice} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div>
            <label htmlFor="purchaseDate" className="block text-sm font-medium text-gray-700">Data da Compra</label>
            <input type="date" id="purchaseDate" name="purchaseDate" value={purchaseForm.purchaseDate} onChange={handleFormChange} required className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm p-2" />
          </div>
          <div className="col-span-full flex justify-end">
            <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2">
              Registrar Compra
            </button>
          </div>
        </form>

        <h3 className="text-xl font-semibold text-gray-800 mb-4">Histórico de Compras</h3>
        {purchases.length === 0 ? (
          <p className="text-gray-600">Nenhuma compra registrada.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg shadow-md">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Produto</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fornecedor</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Preço Total</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {purchases.map((purchase) => {
                  const product = products.find(p => p.id === purchase.productId);
                  const supplier = suppliers.find(s => s.id === purchase.supplierId);
                  const purchaseDate = purchase.purchaseDate?.toDate ? purchase.purchaseDate.toDate().toLocaleDateString() : purchase.purchaseDate;
                  return (
                    <tr key={purchase.id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{product?.name || 'Produto Desconhecido'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{supplier?.name || 'Fornecedor Desconhecido'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchase.quantity}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">R$ {(purchase.quantity * purchase.costPrice).toFixed(2)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{purchaseDate}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // Renderiza o conteúdo da aba ativa
  const renderContent = () => {
    if (loadingFirebase) {
      return <LoadingSpinner />;
    }
    if (firebaseError) {
      return <div className="text-red-600 text-center p-8 text-lg">{firebaseError}</div>;
    }

    if (!userId) {
      // Se não houver usuário logado, mostra o formulário de login/registro
      return showAuthForm === 'login' ? (
        <Login
          onLoginSuccess={() => {}} // O modal é acionado dentro do componente Login
          onSwitchToRegister={() => setShowAuthForm('register')}
          showModal={showModal}
        />
      ) : (
        <Register
          onRegisterSuccess={() => setShowAuthForm('login')} // Redireciona para login após cadastro bem-sucedido
          onSwitchToLogin={() => setShowAuthForm('login')}
          showModal={showModal}
        />
      );
    }

    // Se o usuário estiver logado, mostra o conteúdo principal do aplicativo
    if (loadingData) {
      return <LoadingSpinner />;
    }

    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'products':
        return <ProductsManagement />;
      case 'suppliers':
        return <SuppliersManagement />;
      case 'sales':
        return <SalesManagement />;
      case 'purchases':
        return <PurchasesManagement />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 font-sans text-gray-900 flex flex-col">
      {/* Cabeçalho */}
      <header className="bg-gradient-to-r from-indigo-600 to-purple-700 text-white shadow-lg p-4">
        <div className="container mx-auto flex flex-wrap items-center justify-between">
          <h1 className="text-3xl font-extrabold tracking-tight">
            IcarStok
          </h1>
          {userId && ( // Só mostra a navegação se o usuário estiver logado
            <nav className="mt-4 md:mt-0">
              <ul className="flex flex-wrap space-x-4 md:space-x-6">
                <li>
                  <button
                    onClick={() => setActiveTab('dashboard')}
                    className={`px-4 py-2 rounded-md transition-colors duration-200 ${activeTab === 'dashboard' ? 'bg-indigo-700 text-white shadow-md' : 'text-indigo-100 hover:bg-indigo-500 hover:bg-opacity-20'}`}
                  >
                    Dashboard
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('products')}
                    className={`px-4 py-2 rounded-md transition-colors duration-200 ${activeTab === 'products' ? 'bg-indigo-700 text-white shadow-md' : 'text-indigo-100 hover:bg-indigo-500 hover:bg-opacity-20'}`}
                  >
                    Produtos
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('suppliers')}
                    className={`px-4 py-2 rounded-md transition-colors duration-200 ${activeTab === 'suppliers' ? 'bg-indigo-700 text-white shadow-md' : 'text-indigo-100 hover:bg-indigo-500 hover:bg-opacity-20'}`}
                  >
                    Fornecedores
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('sales')}
                    className={`px-4 py-2 rounded-md transition-colors duration-200 ${activeTab === 'sales' ? 'bg-indigo-700 text-white shadow-md' : 'text-indigo-100 hover:bg-indigo-500 hover:bg-opacity-20'}`}
                  >
                    Vendas
                  </button>
                </li>
                <li>
                  <button
                    onClick={() => setActiveTab('purchases')}
                    className={`px-4 py-2 rounded-md transition-colors duration-200 ${activeTab === 'purchases' ? 'bg-indigo-700 text-white shadow-md' : 'text-indigo-100 hover:bg-indigo-500 hover:bg-opacity-20'}`}
                  >
                    Compras
                  </button>
                </li>
              </ul>
            </nav>
          )}
        </div>
      </header>

      {/* Conteúdo principal */}
      <main className="container mx-auto p-4 flex-grow">
        {userId && ( // Só mostra o display de usuário e botão de logout se o usuário estiver logado
          <div className="mb-4">
            <UserInfoDisplay userId={userId} onLogout={handleLogout} />
          </div>
        )}
        {renderContent()}
      </main>

      {/* Rodapé (opcional) */}
      <footer className="bg-gray-800 text-white text-center p-4 mt-8">
        <p>&copy; {new Date().getFullYear()} IcarStok. Todos os direitos reservados.</p>
      </footer>

      {/* Modal de feedback */}
      {modal && <Modal message={modal.message} type={modal.type} onClose={closeModal} />}
    </div>
  );
}

// Componente AppWrapper para envolver App com FirebaseProvider
export default function AppWrapper() {
  return (
    <FirebaseProvider>
      <App />
    </FirebaseProvider>
  );
}
