import { type FormEvent, useCallback, useEffect, useState } from "react";
import { ActionModal } from "../../../components/ui/ActionModal";
import { DataTable, type DataColumn } from "../../../components/ui/DataTable";
import { PageScaffold } from "../../../components/ui/PageScaffold";
import { adminApi } from "../../../lib/api/admin-api";
import type { SystemConfigDoc } from "../../../lib/types/firestore";
import { toActionErrorMessage } from "../../../lib/utils/errors";
import { formatDateTime, stringifySafe } from "../../../lib/utils/formatters";

function toEditableValue(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function parseConfigValue(raw: string): unknown {
  const trimmed = raw.trim();
  if (!trimmed) {
    return "";
  }
  try {
    return JSON.parse(trimmed);
  } catch {
    return raw;
  }
}

export function SystemConfigsPage() {
  const [category, setCategory] = useState("");
  const [keyword, setKeyword] = useState("");
  const [rows, setRows] = useState<SystemConfigDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [mutatingKey, setMutatingKey] = useState<string | null>(null);

  const [newConfigKey, setNewConfigKey] = useState("");
  const [newCategory, setNewCategory] = useState("feature");
  const [newValueText, setNewValueText] = useState("{}");
  const [newDescription, setNewDescription] = useState("");

  const [editTarget, setEditTarget] = useState<SystemConfigDoc | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editValueText, setEditValueText] = useState("");
  const [editDescription, setEditDescription] = useState("");

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const configs = await adminApi.listSystemConfigs({
        limit: 200,
        category: category || undefined,
        keyword: keyword.trim() || undefined,
      });
      setRows(configs);
    } catch (e) {
      setError(toActionErrorMessage(e, "운영설정 조회 중 오류가 발생했습니다."));
    } finally {
      setLoading(false);
    }
  }, [category, keyword]);

  useEffect(() => {
    void loadConfigs();
  }, [loadConfigs]);

  const handleUpsert = async () => {
    const configKey = newConfigKey.trim();
    const categoryValue = newCategory.trim();
    if (!configKey || !categoryValue) {
      setError("config key와 category를 입력해 주세요.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("upsert-system-config");
      const result = await adminApi.upsertSystemConfig({
        configKey,
        category: categoryValue,
        value: parseConfigValue(newValueText),
        description: newDescription.trim() || "",
      });
      setSuccess(`systemConfig(${result.configKey}) ${result.updated ? "업데이트" : "생성"}를 완료했습니다.`);
      setNewConfigKey("");
      setNewCategory("feature");
      setNewValueText("{}");
      setNewDescription("");
      await loadConfigs();
    } catch (e) {
      setError(toActionErrorMessage(e, "운영설정 upsert 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const openUpdateModal = (row: SystemConfigDoc) => {
    setError(null);
    setEditTarget(row);
    setEditCategory(row.category);
    setEditValueText(toEditableValue(row.value));
    setEditDescription(row.description ?? "");
  };

  const submitUpdateModal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!editTarget) return;

    const categoryValue = editCategory.trim();
    if (!categoryValue) {
      setError("category는 비워둘 수 없습니다.");
      return;
    }

    try {
      setError(null);
      setSuccess(null);
      setMutatingKey("update-system-config");
      await adminApi.updateSystemConfig({
        configKey: editTarget.id,
        category: categoryValue,
        value: parseConfigValue(editValueText),
        description: editDescription.trim() || "",
      });
      setSuccess(`systemConfig(${editTarget.id})를 업데이트했습니다.`);
      setEditTarget(null);
      await loadConfigs();
    } catch (e) {
      setError(toActionErrorMessage(e, "운영설정 update 중 오류가 발생했습니다."));
    } finally {
      setMutatingKey(null);
    }
  };

  const columns: DataColumn<SystemConfigDoc>[] = [
    {
      key: "id",
      header: "Config Key",
      render: (row) => <span className="mono-text">{row.id}</span>,
    },
    {
      key: "category",
      header: "카테고리",
      render: (row) => row.category,
    },
    {
      key: "value",
      header: "값",
      render: (row) => <span className="mono-text">{stringifySafe(row.value)}</span>,
    },
    {
      key: "description",
      header: "설명",
      render: (row) => row.description ?? "-",
    },
    {
      key: "updatedAt",
      header: "수정 시각",
      render: (row) => formatDateTime(row.updatedAt),
    },
    {
      key: "actions",
      header: "액션",
      width: "120px",
      render: (row) => (
        <button
          type="button"
          className="action-btn subtle"
          onClick={() => openUpdateModal(row)}
          disabled={Boolean(mutatingKey)}
        >
          update
        </button>
      ),
    },
  ];

  return (
    <>
      <PageScaffold title="운영 설정" description="시스템 설정값 목록 조회 및 설정 upsert/update를 수행합니다.">
        <div className="toolbar toolbar-grid">
          <label>
            카테고리
            <select value={category} onChange={(event) => setCategory(event.target.value)}>
              <option value="">전체</option>
              <option value="feature">feature</option>
              <option value="notice">notice</option>
              <option value="policy">policy</option>
            </select>
          </label>
          <label>
            검색
            <input
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="key/category/value"
            />
          </label>
        </div>

        <div className="toolbar toolbar-grid-4">
          <label>
            Config Key
            <input
              value={newConfigKey}
              onChange={(event) => setNewConfigKey(event.target.value)}
              placeholder="feature_flags"
            />
          </label>
          <label>
            Category
            <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="feature" />
          </label>
          <label>
            Value(JSON or text)
            <input
              value={newValueText}
              onChange={(event) => setNewValueText(event.target.value)}
              placeholder='{"enabled":true}'
            />
          </label>
          <label>
            Description
            <input
              value={newDescription}
              onChange={(event) => setNewDescription(event.target.value)}
              placeholder="설명"
            />
          </label>
        </div>

        <div className="toolbar-actions">
          <button
            type="button"
            className="action-btn primary"
            onClick={() => void handleUpsert()}
            disabled={Boolean(mutatingKey)}
          >
            upsert
          </button>
        </div>

        {success && <p className="success-inline">{success}</p>}
        {error && <p className="error-inline">{error}</p>}

        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          loading={loading}
          emptyText="운영 설정 데이터가 없습니다."
        />
      </PageScaffold>

      <ActionModal
        open={Boolean(editTarget)}
        title="운영설정 update"
        submitLabel="update"
        submitTone="primary"
        submitting={mutatingKey === "update-system-config"}
        onClose={() => setEditTarget(null)}
        onSubmit={(event) => void submitUpdateModal(event)}
      >
        <label>
          Category
          <input value={editCategory} onChange={(event) => setEditCategory(event.target.value)} />
        </label>
        <label>
          Value (JSON or text)
          <textarea value={editValueText} onChange={(event) => setEditValueText(event.target.value)} />
        </label>
        <label>
          Description
          <input value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
        </label>
      </ActionModal>
    </>
  );
}
