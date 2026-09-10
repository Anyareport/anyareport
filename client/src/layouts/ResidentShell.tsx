import { Layout, Menu, Button, Drawer, Grid } from "antd";
import {
  HomeOutlined,
  FileAddOutlined,
  UnorderedListOutlined,
  BellOutlined,
  UserOutlined,
  MenuOutlined,
  LogoutOutlined,
} from "@ant-design/icons";
import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useState } from "react";
import Logo from "../components/Logo";
import { logout } from "../lib/firebase";
import { useAuth } from "../contexts/AuthContext";

const { Header, Content, Footer } = Layout;
const { useBreakpoint } = Grid;

const menuItems = [
  { key: "/resident", icon: <HomeOutlined />, label: "Home" },
  {
    key: "/resident/submit",
    icon: <FileAddOutlined />,
    label: "Report Incident",
  },
  {
    key: "/resident/reports",
    icon: <UnorderedListOutlined />,
    label: "My Reports",
  },
  {
    key: "/resident/notifications",
    icon: <BellOutlined />,
    label: "Notifications",
  },
  { key: "/resident/profile", icon: <UserOutlined />, label: "Profile" },
];

export default function ResidentShell() {
  const navigate = useNavigate();
  const location = useLocation();
  const screens = useBreakpoint();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { profile } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const menu = (
    <Menu
      mode="inline"
      selectedKeys={[location.pathname]}
      items={menuItems}
      onClick={({ key }) => {
        navigate(key);
        setDrawerOpen(false);
      }}
    />
  );

  return (
    <Layout style={{ minHeight: "100vh" }}>
      <Header
        style={{
          background: "#282F49",
          padding: "0 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {!screens.md && (
            <Button
              type="text"
              icon={<MenuOutlined style={{ color: "#fff" }} />}
              onClick={() => setDrawerOpen(true)}
            />
          )}
          <Logo light size="sm" />
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ color: "#fff", fontSize: 13 }}>{profile?.name}</span>
          <Button
            type="text"
            icon={<LogoutOutlined style={{ color: "#fff" }} />}
            onClick={handleLogout}
          />
        </div>
      </Header>

      <Layout>
        {screens.md && (
          <Layout.Sider
            width={220}
            style={{
              background: "#fff",
              position: "sticky",
              top: 64,
              height: "calc(100vh - 64px)",
              overflow: "auto",
            }}
          >
            {menu}
          </Layout.Sider>
        )}
        <Content
          style={{ padding: screens.md ? 24 : 16, background: "#f5f5f5" }}
        >
          <Outlet />
        </Content>
      </Layout>

      <Footer
        style={{
          textAlign: "center",
          background: "#282F49",
          color: "#fff",
          padding: "12px",
        }}
      >
        © 2026 Anyareport. All Rights Reserved. | Barangay Don Mariano Marcos,
        Nueva Vizcaya
      </Footer>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        placement="left"
      >
        {menu}
      </Drawer>
    </Layout>
  );
}
