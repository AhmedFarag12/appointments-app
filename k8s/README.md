# Kubernetes deployment (k3s on Ubuntu VM)

## 1. Install k3s (once)

```bash
curl -sfL https://get.k3s.io | sh -
sudo chmod 644 /etc/rancher/k3s/k3s.yaml
mkdir -p ~/.kube && cp /etc/rancher/k3s/k3s.yaml ~/.kube/config
kubectl get nodes
```

## 2. Build the image and load it into k3s

k3s uses containerd, not Docker, so a locally built image must be imported:

```bash
docker build -t appointments-app:latest .
docker save appointments-app:latest | sudo k3s ctr images import -
```

(If you push to a registry instead, change `images:` in `kustomization.yaml`.)

## 3. Secrets

```bash
cp k8s/secrets.env.example k8s/secrets.env
sed -i "s/^JWT_SECRET=.*/JWT_SECRET=$(openssl rand -hex 32)/" k8s/secrets.env
```

## 4. Deploy

```bash
kubectl apply -k k8s/
kubectl -n appointments get pods -w
```

## 5. Open the app

- Through Traefik ingress: `http://<VM-IP>/`
- Through NodePort: `http://<VM-IP>:30080/`

Smoke test: `bash scripts/smoke-test.sh http://<VM-IP>`

If `ufw` is enabled on the VM: `sudo ufw allow 30080/tcp && sudo ufw allow 80/tcp`

### Reaching it from other devices (VMware NAT)

The Windows host can already reach `<VM-IP>` on VMware NAT. For other devices
on the LAN, forward the ports from the host to the VM — run on Windows in an
**Administrator** PowerShell:

```powershell
powershell -ExecutionPolicy Bypass -File scripts\vmware-port-forward.ps1 -VmIp <VM-IP>
```

Then open `http://<windows-ip>:30080`. Undo with `-Remove`. If the VM's IP
changes (DHCP), re-run the script with the new IP.

## Updating after a code change

```bash
docker build -t appointments-app:latest .
docker save appointments-app:latest | sudo k3s ctr images import -
kubectl -n appointments rollout restart deployment/app
```

## Useful commands

```bash
kubectl -n appointments logs -f deployment/app
kubectl -n appointments exec -it mongo-0 -- mongosh appointments
kubectl delete -k k8s/        # WARNING: deletes the namespace, including the Mongo data (PVC)
```
