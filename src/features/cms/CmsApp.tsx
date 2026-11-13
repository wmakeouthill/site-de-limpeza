import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useInRouterContext,
  useParams,
} from "react-router-dom";
import { CmsAuthGuard } from "./components/CmsAuthGuard";
import { ArticleEditorPage } from "./pages/ArticleEditorPage";
import { CaseEditorPage } from "./pages/CaseEditorPage";
import { GuideEditorPage } from "./pages/GuideEditorPage";
import { CmsAnalyticsPage } from "./pages/CmsAnalyticsPage";
import { CmsContentPage } from "./pages/CmsContentPage";
import { CmsDepartmentsPage } from "./pages/CmsDepartmentsPage";
import { CmsKitsPage } from "./pages/CmsKitsPage";
import { CmsOffersPage } from "./pages/CmsOffersPage";
import { CmsProductEditorPage } from "./pages/CmsProductEditorPage";
import { CmsProductsPage } from "./pages/CmsProductsPage";
import { CmsPromotionEditorPage, CmsPromotionsPage } from "./pages/CmsPromotionsPage";
import { CmsSettingsPage } from "./pages/CmsSettingsPage";
import { CmsTestimonialsPage } from "./pages/CmsTestimonialsPage";

function CaseParamRedirect() {
  const { id } = useParams();
  if (!id || id === "novo") {
    return <Navigate to="/cms/guias/novo" replace />;
  }
  return <Navigate to={`/cms/guias/${id}`} replace />;
}

export function CmsRoutes() {
  return (
    <Routes>
      <Route path="/cms" element={<CmsContentPage />} />
      <Route path="/cms/produtos" element={<CmsProductsPage />} />
      <Route path="/cms/produtos/novo" element={<CmsProductEditorPage />} />
      <Route path="/cms/produtos/:id" element={<CmsProductEditorPage />} />
      <Route path="/cms/departamentos" element={<CmsDepartmentsPage />} />
      <Route path="/cms/kits" element={<CmsKitsPage />} />
      <Route path="/cms/ofertas" element={<CmsOffersPage />} />
      <Route path="/cms/promocoes" element={<CmsPromotionsPage />} />
      <Route path="/cms/promocoes/nova" element={<CmsPromotionEditorPage />} />
      <Route path="/cms/promocoes/:id" element={<CmsPromotionEditorPage />} />
      <Route path="/cms/conteudo" element={<CmsContentPage />} />
      <Route path="/cms/artigos" element={<CmsContentPage />} />
      <Route path="/cms/artigos/novo" element={<ArticleEditorPage />} />
      <Route path="/cms/artigos/:id" element={<ArticleEditorPage />} />
      <Route path="/cms/guias" element={<CmsContentPage />} />
      <Route path="/cms/guias/novo" element={<GuideEditorPage />} />
      <Route path="/cms/guias/:id" element={<GuideEditorPage />} />
      <Route path="/cms/cases/novo" element={<Navigate to="/cms/guias/novo" replace />} />
      <Route path="/cms/cases/:id" element={<CaseParamRedirect />} />
      <Route path="/cms/cases" element={<Navigate to="/cms/guias" replace />} />
      <Route path="/cms/cases/*" element={<Navigate to="/cms/guias" replace />} />
      <Route path="/cms/depoimentos" element={<CmsTestimonialsPage />} />
      <Route path="/cms/metricas" element={<CmsAnalyticsPage />} />
      <Route path="/cms/configuracoes" element={<CmsSettingsPage />} />
      <Route path="*" element={<Navigate to="/cms" replace />} />
    </Routes>
  );
}

export function CmsApp() {
  const inRouter = useInRouterContext();
  const content = (
    <CmsAuthGuard>
      <CmsRoutes />
    </CmsAuthGuard>
  );

  if (inRouter) {
    return content;
  }

  return <BrowserRouter>{content}</BrowserRouter>;
}

export default CmsApp;
