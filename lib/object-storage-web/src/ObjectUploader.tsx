import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import Uppy from "@uppy/core";
import type { UppyFile, UploadResult } from "@uppy/core";
import DashboardModal from "@uppy/react/dashboard-modal";
import "@uppy/core/css/style.min.css";
import "@uppy/dashboard/css/style.min.css";
import "./uppy-theme.css";
import AwsS3 from "@uppy/aws-s3";

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  /**
   * Function to get upload parameters for each file.
   * IMPORTANT: This receives the file object - use file.name, file.size, file.type
   * to request per-file presigned URLs from your backend.
   */
  onGetUploadParameters: (
    file: UppyFile<Record<string, unknown>, Record<string, unknown>>
  ) => Promise<{
    method: "PUT";
    url: string;
    headers?: Record<string, string>;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  onError?: (file: UppyFile<Record<string, unknown>, Record<string, unknown>> | undefined, error: Error) => void;
  buttonClassName?: string;
  children: ReactNode;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management.
 *
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 *
 * The component uses Uppy v5 under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 *
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded
 *   (default: 1)
 * @param props.maxFileSize - Maximum file size in bytes (default: 10MB)
 * @param props.onGetUploadParameters - Function to get upload parameters for each file.
 *   Receives the UppyFile object with file.name, file.size, file.type properties.
 *   Use these to request per-file presigned URLs from your backend. Returns method,
 *   url, and optional headers for the upload request.
 * @param props.onComplete - Callback function called when upload is complete. Typically
 *   used to make post-upload API calls to update server state and set object ACL
 *   policies.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 1,
  maxFileSize = 10485760, // 10MB default
  onGetUploadParameters,
  onComplete,
  onError,
  buttonClassName,
  children,
}: ObjectUploaderProps) {
  const onCompleteRef = useRef(onComplete);
  const onErrorRef = useRef(onError);
  const onGetUploadParametersRef = useRef(onGetUploadParameters);
  useEffect(() => { onCompleteRef.current = onComplete; }, [onComplete]);
  useEffect(() => { onErrorRef.current = onError; }, [onError]);
  useEffect(() => { onGetUploadParametersRef.current = onGetUploadParameters; }, [onGetUploadParameters]);

  const [showModal, setShowModal] = useState(false);
  const [uppy] = useState(() =>
    new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize,
      },
      autoProceed: false,
      locale: {
        pluralize: (n: number) => (n === 1 ? 0 : 1),
        strings: {
          youCanOnlyUploadX: { 0: "Você pode enviar apenas %{smart_count} arquivo", 1: "Você pode enviar apenas %{smart_count} arquivos" },
          youHaveToAtLeastSelectX: { 0: "Selecione ao menos %{smart_count} arquivo", 1: "Selecione ao menos %{smart_count} arquivos" },
          exceedsSize: "Arquivo excede o tamanho máximo permitido",
          uploadXFiles: { 0: "Enviar %{smart_count} arquivo", 1: "Enviar %{smart_count} arquivos" },
          uploadXNewFiles: { 0: "Enviar +%{smart_count} arquivo", 1: "Enviar +%{smart_count} arquivos" },
          upload: "Enviar",
          addMoreFiles: "Adicionar mais arquivos",
          addingMoreFiles: "Adicionando mais arquivos",
          back: "Voltar",
          cancel: "Cancelar",
          cancelUpload: "Cancelar envio",
          done: "Concluído",
          filesUploadedOfTotal: { 0: "%{complete} de %{smart_count} arquivo enviado", 1: "%{complete} de %{smart_count} arquivos enviados" },
          dataUploadedOfTotal: "%{complete} de %{total}",
          xTimeLeft: "%{time} restante",
          uploadComplete: "Envio concluído",
          uploadPaused: "Envio pausado",
          resumeUpload: "Retomar envio",
          pauseUpload: "Pausar envio",
          retryUpload: "Tentar novamente",
          xMoreFilesAdded: { 0: "%{smart_count} arquivo adicionado", 1: "%{smart_count} arquivos adicionados" },
          noInternetConnection: "Sem conexão com a internet",
          connectedToInternet: "Conectado à internet",
          dropHereOr: "Solte aqui ou %{browse}",
          browse: "escolha do computador",
          dropHint: "Solte seus arquivos aqui",
          uploadingXFiles: { 0: "Enviando %{smart_count} arquivo", 1: "Enviando %{smart_count} arquivos" },
          loadingFile: "Carregando arquivo…",
        },
      },
    })
      .use(AwsS3, {
        shouldUseMultipart: false,
        getUploadParameters: (file) => onGetUploadParametersRef.current(file),
      })
      .on("complete", (result) => {
        onCompleteRef.current?.(result);
      })
      .on("upload-error", (file, error) => {
        onErrorRef.current?.(file, error);
      })
      .on("restriction-failed", (file, error) => {
        onErrorRef.current?.(file as any, error);
      })
  );

  const dashboardLocale = {
    pluralize: (n: number) => (n === 1 ? 0 : 1),
    strings: {
      addMore: "+ Adicionar mais",
      addMoreFiles: "Adicionar mais arquivos",
      addingMoreFiles: "Adicionando mais arquivos",
      allowAccessDescription: "Para tirar fotos ou gravar vídeos, permita o acesso à câmera.",
      allowAccessTitle: "Permita o acesso à câmera",
      authenticateWith: "Conectar ao %{pluginName}",
      authenticateWithTitle: "Faça login para conectar ao %{pluginName}",
      back: "Voltar",
      browse: "escolha do computador",
      cancel: "Cancelar",
      cancelUpload: "Cancelar envio",
      closeModal: "Fechar",
      companionAuthError: "Acesso negado",
      complete: "Concluído",
      connectedToInternet: "Conectado à internet",
      copyLink: "Copiar link",
      copyLinkToClipboardFallback: "Copie a URL abaixo",
      copyLinkToClipboardSuccess: "Link copiado!",
      dashboardTitle: "Enviar arquivos",
      dashboardWindowTitle: "Janela de envio de arquivos",
      dataUploadedOfTotal: "%{complete} de %{total}",
      done: "Concluído",
      dropHereOr: "Solte aqui ou %{browse}",
      dropHint: "Solte seus arquivos aqui",
      dropPasteBoth: "Solte os arquivos aqui, cole ou %{browse}",
      dropPasteFiles: "Solte os arquivos aqui ou %{browse}",
      dropPasteFolders: "Solte as pastas aqui ou %{browse}",
      dropPasteImportBoth: "Solte arquivos, cole, %{browse} ou importe de",
      dropPasteImportFiles: "Solte arquivos, cole, %{browse} ou importe de",
      dropPasteImportFolders: "Solte pastas, cole, %{browse} ou importe de",
      editFile: "Editar arquivo",
      editing: "Editando %{file}",
      emptyFolderAdded: "Nenhum arquivo adicionado — a pasta está vazia",
      exceedsSize: "Arquivo excede o tamanho máximo",
      failedToUpload: "Falha ao enviar %{file}",
      filesUploadedOfTotal: { 0: "%{complete} de %{smart_count} arquivo enviado", 1: "%{complete} de %{smart_count} arquivos enviados" },
      filter: "Filtrar",
      finishEditingFile: "Concluir edição",
      folderAdded: { 0: "%{smart_count} arquivo adicionado de %{folder}", 1: "%{smart_count} arquivos adicionados de %{folder}" },
      generatingThumbnails: "Gerando miniaturas…",
      importFiles: "Importar arquivos de:",
      loading: "Carregando…",
      logOut: "Sair",
      myDevice: "Meu dispositivo",
      noFilesFound: "Nenhum arquivo ou pasta aqui",
      noInternetConnection: "Sem conexão com a internet",
      openFolderNamed: "Abrir pasta %{name}",
      pause: "Pausar",
      pauseUpload: "Pausar envio",
      poweredBy: "",
      processingXFiles: { 0: "Processando %{smart_count} arquivo", 1: "Processando %{smart_count} arquivos" },
      removeFile: "Remover arquivo",
      resetFilter: "Limpar filtro",
      resume: "Retomar",
      resumeUpload: "Retomar envio",
      retry: "Tentar novamente",
      retryUpload: "Tentar novamente",
      revert: "Reverter",
      saveChanges: "Salvar alterações",
      selectAllFilesFromFolderNamed: "Selecionar todos os arquivos de %{name}",
      selectX: { 0: "Selecionar %{smart_count}", 1: "Selecionar %{smart_count}" },
      takePicture: "Tirar foto",
      timedOut: "O envio travou por %{seconds} segundos e foi cancelado.",
      upload: "Enviar",
      uploadComplete: "Envio concluído!",
      uploadFailed: "Falha no envio",
      uploadPaused: "Envio pausado",
      uploadXFiles: { 0: "Enviar %{smart_count} arquivo", 1: "Enviar %{smart_count} arquivos" },
      uploadXNewFiles: { 0: "Enviar +%{smart_count} arquivo", 1: "Enviar +%{smart_count} arquivos" },
      uploading: "Enviando…",
      uploadingXFiles: { 0: "Enviando %{smart_count} arquivo", 1: "Enviando %{smart_count} arquivos" },
      xFilesSelected: { 0: "%{smart_count} arquivo selecionado", 1: "%{smart_count} arquivos selecionados" },
      xMoreFilesAdded: { 0: "%{smart_count} arquivo adicionado", 1: "%{smart_count} arquivos adicionados" },
      xTimeLeft: "%{time} restante",
      youCanOnlyUploadX: { 0: "Você pode enviar apenas %{smart_count} arquivo", 1: "Você pode enviar apenas %{smart_count} arquivos" },
      youHaveToAtLeastSelectX: { 0: "Selecione ao menos %{smart_count} arquivo", 1: "Selecione ao menos %{smart_count} arquivos" },
    },
  };

  return (
    <div>
      <button onClick={() => setShowModal(true)} className={buttonClassName}>
        {children}
      </button>

      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
        locale={dashboardLocale}
      />
    </div>
  );
}
