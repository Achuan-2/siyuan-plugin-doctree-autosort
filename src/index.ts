import {
    Plugin,
    fetchPost,
    IModel,
} from "siyuan";
import "@/index.scss";
import { putFile, getHPathByID, getDoc, listDocTree, getFile } from "./api";

export default class PluginSample extends Plugin {

    customTab: () => IModel;

    async onload() {
        // 监听文档树右键菜单
        this.eventBus.on("open-menu-doctree", this.addSortButton.bind(this));
    }

    private addSortButton = ({ detail }: any) => {
        // 判断是否是自定义排序模式，不是则不添加按钮
        if (window.siyuan.config.fileTree.sort != 6) {
            return false;
        }
        const elements = detail.elements;
        if (elements.length === 1) {
            const element = elements[0];
            const isParentDoc = element.getAttribute("data-count") > 0;
            const isNotebook = element.getAttribute("data-type") === "navigation-root";
            const id = isNotebook ? element.parentNode.getAttribute("data-url") : element.getAttribute("data-node-id");
            if (isParentDoc || isNotebook) {
                detail.menu.addItem({
                    icon: "iconSort",
                    label: this.i18n.sortMenuAsc,
                    click: () => this.sortDocuments(id, isNotebook, true)
                });
                detail.menu.addItem({
                    icon: "iconSort",
                    label: this.i18n.sortMenuDesc,
                    click: () => this.sortDocuments(id, isNotebook, false)
                });
            }
        }
    }

    private async sortDocuments(id: string, isNotebook: boolean, ascending: boolean) {

        // 保存文件的辅助函数
        let listDocTreeQuery;
        let boxID;
        if (!isNotebook) {// 子文档

            // 获取父文档信息
            const parentDocInfo = await getDoc(id);
            boxID = parentDocInfo.box;
            // 获取子文档列表
            listDocTreeQuery = {
                "notebook": boxID,
                "path": parentDocInfo.path.replace(".sy", "")
            };
        } else {// 笔记本
            boxID = id;
            listDocTreeQuery = {
                "notebook": boxID,
                "path": "/"
            };
        }
        // 获取子文档id
        const childDocIds = (await listDocTree(boxID,listDocTreeQuery.path)).tree;
        // 获取所有文档名称并排序
        const idNamePairs = await Promise.all(childDocIds.map(async (doc: any) => {
            const name = await getHPathByID(doc.id);
            return { id: doc.id, name: name };
        }));
        const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });
        idNamePairs.sort((a, b) => ascending ? collator.compare(a.name, b.name) : collator.compare(b.name, a.name));
        // 创建排序结果对象
        const sortedResult = {};
        idNamePairs.forEach((pair, index) => {
            sortedResult[pair.id] = index;
        });
        // 获取现有的sort.json文件
        const sortJson = await getFile(`/data/${boxID}/.siyuan/sort.json`);


        // 更新排序值
        for (let id in sortedResult) {
                sortJson[id] = sortedResult[id];
        }

        // 保存更新后的sort.json文件
        await putFile(`/data/${boxID}/.siyuan/sort.json`, sortJson);

        // 刷新文档树
        let element;
        if (!isNotebook) {
            element = document.querySelector(`.file-tree li[data-node-id="${id}"] > .b3-list-item__toggle--hl`);
            if (element) {
                element.click();
                element.click();
            }
        } else {
            element = document.querySelector(`.file-tree ul[data-url="${id}"] > li >.b3-list-item__toggle--hl`);
            if (element) {
                element.click();
                element.click();
            }
        }

    }
}
