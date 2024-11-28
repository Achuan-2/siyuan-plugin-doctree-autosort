import {
    Plugin,
    IModel,
} from "siyuan";
import "@/index.scss";
import { putFile, getHPathByID, getDoc, listDocTree, getFile } from "./api";

export default class DoctreeAutosort extends Plugin {

    customTab: () => IModel;

    async onload() {
        // 监听文档树右键菜单
        this.eventBus.on("open-menu-doctree", this.addSortButton.bind(this));
    }

    private async addSortButton ({ detail }: any)  {
        // 判断是否是自定义排序模式，不是则不添加按钮
        if (window.siyuan.config.fileTree.sort != 6) {
            return false;
        }
        const elements = detail.elements;
        if (elements.length === 1) {
            const element = elements[0];
            const isParentDoc = element.getAttribute("data-count") > 0;
            const isNotebook = element.getAttribute("data-type") === "navigation-root";
            let sortMode;



            if (isParentDoc || isNotebook) {
                if (isNotebook) {
                    sortMode = element.parentNode.getAttribute("data-sortmode");
                } else {
                    // 如果是父文档，寻找最近的ul node
                    const topElement = this.hasTopClosestByTag(element, "UL");
                    if (!topElement) {
                        return;
                    }
                    sortMode = topElement.getAttribute("data-sortmode");
                }
                if (sortMode == 6 || (window.siyuan.config.fileTree.sort === 6 && sortMode == 15)) {
                    const id = isNotebook ? element.parentNode.getAttribute("data-url") : element.getAttribute("data-node-id");
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
    }
    private hasTopClosestByTag = (element: Node, nodeName: string) => {
        let closest = this.hasClosestByTag(element, nodeName);
        let parentClosest: boolean | HTMLElement = false;
        let findTop = false;
        while (closest && !closest.classList.contains("protyle-wysiwyg") && !findTop) {
            parentClosest = this.hasClosestByTag(closest.parentElement, nodeName);
            if (parentClosest) {
                closest = parentClosest;
            } else {
                findTop = true;
            }
        }
        return closest || false;
    };
    private hasClosestByTag = (element: Node, nodeName: string) => {
        if (!element || element.nodeType === 9) {
            return false;
        }
        if (element.nodeType === 3) {
            element = element.parentElement;
        }
        let e = element as HTMLElement;
        let isClosest = false;
        while (e && !isClosest && !e.classList.contains("b3-typography")) {
            if (e.nodeName.indexOf(nodeName) === 0) {
                isClosest = true;
            } else {
                e = e.parentElement;
            }
        }
        return isClosest && e;
    };
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
